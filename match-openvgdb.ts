import { steps, ProgressFunc } from './lib/ui';
import klaw from 'klaw';
import crypto from 'crypto';
import path from 'path';
import pMapSeries from 'p-map-series';
import fs from 'fs-extra';
import configPlatformsWithGames, {
  configFiltered,
  PlatformWithGames
} from './lib/config-platforms-games';

const ROMS_DIR_FILTERED = './roms-filtered';

type HashedFile = {
  path: string;
  hash: string;
};

const fetchRoms = (progress: ProgressFunc): Promise<string[]> => {
  const files = [];
  return new Promise((resolve, reject) => {
    klaw(ROMS_DIR_FILTERED)
      .on('error', err => {
        reject(err);
      })
      .on('data', item => {
        if (item.stats.isDirectory()) return;
        files.push(item.path);
      })
      .on('end', () => {
        resolve(files);
      });
  });
};

const hashRoms = (
  progress: ProgressFunc,
  roms: string[]
): Promise<HashedFile[]> => {
  return pMapSeries<string, HashedFile>(roms, (rom, i) => {
    const romPath = rom.substr(
      path.resolve(__dirname, ROMS_DIR_FILTERED).length + 1
    );
    progress(romPath, i, roms.length);
    const shasum = crypto.createHash('sha1');
    return new Promise((resolve, reject) => {
      fs.createReadStream(rom)
        .on('error', err => {
          reject(err);
        })
        .on('data', data => {
          shasum.update(data);
        })
        .on('end', () => {
          progress(romPath, i + 1, roms.length);
          resolve({
            path: rom,
            hash: shasum.digest('hex')
          });
        });
    });
  });
};

const matchRomFiles = (platforms: PlatformWithGames[]) => (
  progress: ProgressFunc,
  roms: HashedFile[]
): Promise<PlatformWithGames[]> => {
  let totalGames = 0;
  platforms.forEach(platform => {
    totalGames += (platform.games || []).length;
  });
  let done = 0;
  const _platforms = platforms.map(platform => {
    const platformGames = platform.games || [];
    return {
      ...platform,
      games: platformGames
        .map(game => {
          const file = roms.find(
            rom => rom.hash.toLowerCase() === game.romHash.toLowerCase()
          );
          done++;
          progress(`${platform.name} - ${game.name}`, done, totalGames);
          return {
            ...game,
            romFile: (file && file.path) || null
          };
        })
        .filter(game => !!game.romFile)
    };
  });
  return Promise.resolve(_platforms);
};

const save = (
  progress: ProgressFunc,
  platforms: PlatformWithGames[]
): Promise<void> => {
  return configFiltered.save(platforms);
};

configPlatformsWithGames.load().then(configPlatformsWithGames => {
  return steps(
    {
      title: 'Fetching rom files',
      execute: fetchRoms
    },
    {
      title: 'Hashing rom files',
      execute: hashRoms
    },
    {
      title: 'Match rom files',
      execute: matchRomFiles(configPlatformsWithGames.data)
    },
    {
      title: 'Save',
      execute: save
    }
  );
});