import { steps } from './lib/ui';
import {
  LocalPlatform,
  LocalGame,
  LocalMatchedGame,
  PlatformMatch
} from './lib/types';
import config from './lib/config';
import _ from 'lodash';
import pMapSeries from 'p-map-series';
import stringSimilarity from 'string-similarity';
import klaw from 'klaw';
import path from 'path';

const MATCH_MIN = 0.7;
const ROMS_DIR_FILTERED = './roms-filtered';

type PlarformDir = {
  path: string;
  basename: string;
};

type PlatformFile = {
  path: string;
  filename: string;
  name: string;
};

type PlatformFileRanked = PlatformFile & {
  rank: number;
  match: string;
  // nameSort: string;
};

type PlatformFiles = {
  platform: PlarformDir;
  files: PlatformFileRanked[];
};

// const normaliseName = (name: string): string => {
//   return name.replace(/\(.+\)/g, '').replace(/[\W_]+/g, '');
// };

const normaliseName = (name: string): string => {
  return name
    .replace(/\(.+?\)/g, '')
    .replace(/\[.+?\]/g, '')
    .replace(/[^a-zA-Z0-9\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const configPlatforms = config<LocalPlatform[]>('platforms', []);
const configMatchedGames = config<LocalMatchedGame[]>('games-matched', []);
const configGames = config<LocalGame[]>('games', []);
// const configRoms = config<PlatformFiles[]>('roms', []);

const joinData = (
  platforms: LocalPlatform[],
  games: LocalGame[]
): LocalMatchedGame[] => {
  const validPlatforms = platforms.map(platform => platform.id);
  return games.map(
    game =>
      ({
        ...game,
        platforms: game.platforms
          .filter(id => validPlatforms.includes(id))
          .map(id => {
            return {
              id,
              matched: null
            };
          })
      } as LocalMatchedGame)
  );
};

const matchPlatformGameFile = (
  game: LocalMatchedGame,
  files: PlatformFileRanked[],
  platform: LocalPlatform
): Promise<PlatformMatch> => {
  if (!files.length) {
    return Promise.resolve({
      id: platform.id,
      matched: null
    });
  }

  const fileMatches = files.map(f => normaliseName(f.match));
  let names = [game.name.toLowerCase()];

  if (game.alternative_names) {
    names = names.concat(
      game.alternative_names.map(altName => altName.toLowerCase())
    );
  }

  let matched = null;
  let altMatch = false;

  for (let i = 0; i < names.length; i++) {
    const nameMatch = stringSimilarity.findBestMatch(
      normaliseName(names[i]),
      fileMatches
    );
    if (nameMatch.bestMatch && nameMatch.bestMatch.rating > MATCH_MIN) {
      matched = nameMatch;
      if (i > 0) altMatch = true;
      break;
    }
  }

  return Promise.resolve({
    id: platform.id,
    matched:
      (matched && {
        file: files[matched.bestMatchIndex].path,
        relPath: files[matched.bestMatchIndex].path.substr(
          path.resolve(__dirname, ROMS_DIR_FILTERED).length + 1
        ),
        rating: matched.bestMatch.rating,
        altMatch
      }) ||
      null
  });
};

const matchGame = (
  platforms: LocalPlatform[],
  files: PlatformFiles[],
  game: LocalMatchedGame
): Promise<PlatformMatch> => {
  return pMapSeries(game.platforms, platformMatch => {
    const platform = platforms.find(p => p.id === platformMatch.id);
    const platformFiles =
      files.find(pf => pf.platform.basename === platform.name) || null;
    return matchPlatformGameFile(
      game,
      (platformFiles && platformFiles.files) || [],
      platform
    );
    // return getPlatformFiles(platform, files)
    //   .then(filterPlatformFiles(platform))
    //   .then(matchPlatformGameFile(game, platform));
  }).then(platforms => ({
    ...game,
    platforms
  }));
};

const getPlarformDirs = (): Promise<PlarformDir[]> => {
  const filteredRomDir = path.resolve(__dirname, ROMS_DIR_FILTERED);
  const dirs = [];
  return new Promise((resolve, reject) => {
    klaw(ROMS_DIR_FILTERED, { depthLimit: 0 })
      .on('error', err => {
        reject(err);
      })
      .on('data', item => {
        if (!item.stats.isDirectory() || item.path === filteredRomDir) return;
        dirs.push(item.path);
      })
      .on('end', () => {
        resolve(
          dirs.map(dir => {
            return {
              path: dir,
              basename: path.basename(dir)
            };
          })
        );
      });
  });
};

const getPlatformFiles = (platform: PlarformDir): Promise<PlatformFiles> => {
  const files = [];
  return new Promise((resolve, reject) => {
    klaw(platform.path)
      .on('error', err => {
        reject(err);
      })
      .on('data', item => {
        if (item.stats.isDirectory()) return;
        files.push(item.path);
      })
      .on('end', () => {
        resolve(
          files.map(file => ({
            path: file,
            filename: path.basename(file),
            name: path.basename(file, path.extname(file))
          }))
        );
      });
  })
    .then((files: PlatformFile[]) => {
      return files.filter(file => {
        const isBadDump = file.name.match(/\[b\d*\]/i);
        const isHack = file.name.match(/\[h.*?\]/i);
        return !isBadDump && !isHack;
      });
    })
    .then((files: PlatformFile[]) => {
      return files.map(file => {
        const name = file.name;
        let rank = 0;
        const isUSA = name.match(/\(U\)/i);
        const isUK = name.match(/\(UK\)/i);
        const isEU = name.match(/\(E\)/i);
        const isWorld = name.match(/\(F\)/i);
        if (isUSA) {
          rank = 100;
        } else if (isUK) {
          rank = 200;
        } else if (isEU) {
          rank = 300;
        } else if (isWorld) {
          rank = 400;
        } else {
          rank = 500;
        }
        const isFixed = file.name.match(/\[f(\d+)\]/i);
        const isGood = name.match(/\[!]/i);
        const isOverDump = name.match(/\[o.*?\]/i);
        const oldTranslation = name.match(/\[t\-.*?\]/i);
        const newTranslation = name.match(/\[t\+.*?\]/i);
        if (isGood) rank -= 10;
        if (isOverDump) rank++;
        if (newTranslation) rank--;
        if (oldTranslation) rank++;
        if (isFixed) {
          rank -= parseInt(isFixed[1]);
        }
        return {
          ...file,
          rank,
          // nameSort: name.replace(/^(a|the)\s+/i, ''),
          match: normaliseName(name)
        };
      });
    })
    .then((files: PlatformFileRanked[]) => {
      return {
        platform,
        files: _.orderBy(files, ['match', 'rank'])
      };
    });
};

configPlatforms.load().then(configPlatforms => {
  return configGames.load().then(configGames => {
    return steps(
      {
        title: 'Getting platform directories',
        execute: progress => {
          progress('starting', 0, 1);
          return getPlarformDirs().then(res => {
            progress('done', 1, 1);
            return res;
          });
        }
      },
      {
        title: 'Getting platform files',
        execute: (progress, prev: PlarformDir[]) => {
          return pMapSeries(prev, (platformDir, i) => {
            progress(platformDir.basename, i + 1, prev.length);
            return getPlatformFiles(platformDir);
          });
        }
      },
      // {
      //   title: 'Saving rom data',
      //   execute: (progress, prev: PlatformFiles[]) => {
      //     progress('started', 0, 1);
      //     return configRoms.save(prev).then(() => {
      //       progress('done', 1, 1);
      //     });
      //   }
      // },
      {
        title: 'Joining data',
        execute: (progress, prev: PlatformFiles[]) => {
          progress('done', 1, 1);
          return Promise.resolve(
            joinData(configPlatforms.data, configGames.data)
          ).then(games => {
            return {
              files: prev,
              games
            };
          });
        }
      },
      {
        title: 'Matching games',
        execute: (
          progress,
          prev: { files: PlatformFiles[]; games: LocalMatchedGame[] }
        ) => {
          return pMapSeries(prev.games, (game, i) => {
            progress(game.name, i + 1, prev.games.length);
            return matchGame(configPlatforms.data, prev.files, game);
          });
        }
      },
      {
        title: 'Saving matched games',
        execute: (progress, prev: LocalMatchedGame[]) => {
          progress('started', 0, 1);
          return configMatchedGames.save(_.sortBy(prev, 'sort')).then(() => {
            progress('done', 1, 1);
          });
        }
      }
    );
  });
});

// {
//         title: 'Joining data',
//         execute: progress => {
//           progress('done', 1, 1);
//           return Promise.resolve(
//             joinData(configPlatforms.data, configGames.data)
//           );
//         }
//       },
//       {
//         title: 'Matching games',
//         execute: (progress, prev: LocalMatchedGame[]) => {
//           return pMapSeries(prev, (game, i) => {
//             progress(game.name, i + 1, prev.length);
//             return matchGame(configPlatforms.data, game);
//           });
//         }
//       },
//       {
//         title: 'Saving matched games',
//         execute: (progress, prev: LocalMatchedGame[]) => {
//           progress('started', 0, 1);
//           return configMatchedGames.save(prev).then(() => {
//             progress('done', 1, 1);
//           });
//         }
//       }
