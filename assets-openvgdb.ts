import { steps, ProgressFunc } from './lib/ui';
import _ from 'lodash';
import pLimit from 'p-limit';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import download from 'download';
import { Game } from './lib/openVGDB';
import {
  configFiltered,
  PlatformWithGames
} from './lib/config-platforms-games';

const ASSETS_DIR = '.assets';

const gatherGameAsset = (game: Game) => {
  return [game.cover];
  // return [
  //   game.background_image,
  //   (game.short_screenshots || []).map(screenshot => screenshot.image),
  //   game.background_image,
  //   (game.clip && game.clip.clips.full) || null,
  //   (game.clip && game.clip.preview) || null
  // ];
};

const gatherGamesAssets = (
  platforms: PlatformWithGames[],
  progress: ProgressFunc
) => {
  let totalGames = 0;
  platforms.forEach(platform => {
    totalGames += (platform.games || []).length;
  });
  let current = 0;
  return platforms.map(platform => {
    return (platform.games || []).map((game, i) => {
      progress(game.name, current, totalGames);
      current++;
      return gatherGameAsset(game);
    });
  });
};

const downloadAsset = (asset: string) => {
  const ext = path.extname(asset);
  const hashed = crypto
    .createHash('sha256')
    .update(asset)
    .digest('hex');
  const filename = `${hashed}${ext}`;
  return fs.pathExists(path.resolve(ASSETS_DIR, filename)).then(exists => {
    if (exists) {
      return Promise.resolve();
    }
    return download(asset, ASSETS_DIR, { filename }).then(() => {
      return Promise.resolve();
    });
  });
};

configFiltered.load().then(configFiltered => {
  return steps(
    {
      title: 'Gathering assets',
      execute: progress => {
        const assets = _(gatherGamesAssets(configFiltered.data, progress))
          .flattenDeep()
          .uniq()
          .filter(i => !!i)
          .value();
        return Promise.resolve(assets);
      }
    },
    {
      title: 'Downloading assets',
      execute: (progress, prev: string[]) => {
        const limit = pLimit(10);
        let done = 0;
        return Promise.all(
          prev.map(asset => {
            return limit(() => {
              return downloadAsset(asset).then(() => {
                done++;
                progress(asset, done, prev.length);
              });
            });
          })
        );
      }
    }
  );
});
