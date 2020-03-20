import { steps } from './lib/ui';
import { LocalPlatform, ApiGame, LocalGame, ApiSingleGame } from './lib/types';
import config from './lib/config';
import pMapSeries from 'p-map-series';
import { request, requestSingle } from './lib/rawg';
import _ from 'lodash';

const configPlatforms = config<LocalPlatform[]>('platforms', []);
const configGames = config<LocalGame[]>('games', []);

const matchTags = (game: ApiGame, regex: RegExp) => {
  return !!(game.tags || []).filter(tag => {
    return tag.name.match(regex);
  }).length;
};

configPlatforms.load().then(configPlatforms => {
  return steps(
    {
      title: 'Fetching games info',
      execute: progress => {
        return pMapSeries(configPlatforms.data, (platform, i) => {
          return request<ApiGame>(
            'games',
            {
              platforms: platform.id
            },
            p => {
              progress(platform.name, i + p, configPlatforms.data.length);
            }
          );
        });
      }
    },
    {
      title: 'Mapping game information',
      execute: (progress, prev: ApiGame[][]) => {
        const _games = _(prev)
          .flatten()
          .uniqBy('id')
          .orderBy('id')
          .value();
        return Promise.resolve(
          _games.map((game, i) => {
            progress(game.name, i + 1, _games.length);
            const _game: LocalGame = {
              id: game.id,
              name: game.name,
              slug: game.slug,
              released: game.released,
              background_image: game.background_image,
              rating: game.rating,
              clip: game.clip,
              short_screenshots: game.short_screenshots,
              sort: game.name.replace(/^(a|the)\s+/i, ''),
              platforms: (game.platforms || []).map(p => p.platform.id),
              tags: (game.tags || []).map(tag => tag.name),
              singlePlayer:
                matchTags(game, /(one|1|single).*player/i) ||
                matchTags(game, /^player.+versus.+computer$/i),
              twoPlayer:
                matchTags(game, /(two|2).*player/i) ||
                matchTags(game, /^coop(erative)?$/i) ||
                matchTags(game, /^player.+versus.+player$/i),
              mulitPlayer:
                matchTags(game, /multi.*player/i) ||
                matchTags(game, /Players: 1\-\d+/i)
            };
            // Multiplayer
            // Singleplayer
            // Two players
            // One player
            // 2 players
            // 1 player
            // player versus computer
            // player versus player
            // Players: 1-4
            // coop
            // cooperative
            return _game;
          })
        );
      }
    },
    {
      title: 'Fetching extended game info',
      execute: (progress, prev: LocalGame[]) => {
        return pMapSeries(prev, (game, i) => {
          progress(game.name, i + 1, prev.length);
          return requestSingle<ApiSingleGame>(`games/${game.slug}`).then(
            singleGame => {
              return {
                ...game,
                description: singleGame.description || null,
                description_raw: singleGame.description_raw || null,
                alternative_names: singleGame.alternative_names || null
              };
            }
          );
        });
      }
    },
    {
      title: 'Saving game info',
      execute: (progress, prev: LocalGame[]) => {
        progress('started', 0, 1);
        return configGames.save(prev).then(() => {
          progress('done', 1, 1);
        });
      }
    }
  );
});
