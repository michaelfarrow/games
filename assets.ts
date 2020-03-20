import { steps, ProgressFunc } from './lib/ui';
import { LocalGame } from './lib/types';
import config from './lib/config';
import _ from 'lodash';
import pLimit from 'p-limit';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import download from 'download';

const ASSETS_DIR = '.assets';

const configGames = config<LocalGame[]>('games', []);

const gatherGameAsset = (game: LocalGame) => {
  return [
    game.background_image,
    (game.short_screenshots || []).map(screenshot => screenshot.image),
    game.background_image,
    (game.clip && game.clip.clips.full) || null,
    (game.clip && game.clip.preview) || null
  ];
};

const gatherGamesAssets = (games: LocalGame[], progress: ProgressFunc) => {
  return games.map((game, i) => {
    progress(game.name, i + 1, configGames.data.length);
    return gatherGameAsset(game);
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

configGames.load().then(configGames => {
  return steps(
    {
      title: 'Gathering assets',
      execute: progress => {
        const assets = _(gatherGamesAssets(configGames.data, progress))
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
