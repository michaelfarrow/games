import { steps } from './lib/ui';
import { ApiPlatform, LocalPlatform } from './lib/types';
import config from './lib/config';
import { request } from './lib/rawg';
import inquirer from 'inquirer';
import clear from 'console-clear';

const configPlatforms = config<LocalPlatform[]>('platforms', []);

configPlatforms.load().then(configPlatforms => {
  return steps(
    {
      title: 'Fetching platform info',
      execute: progress => {
        progress('started', 0, 1);
        return request<ApiPlatform>('platforms', {
          ordering: 'name'
        }).then(platforms => {
          progress('done', 1, 1);
          clear();
          return inquirer
            .prompt([
              {
                type: 'checkbox',
                message: 'Select platforms',
                name: 'platforms',
                pageSize: 10,
                choices: platforms.map(platform => ({
                  name: platform.name,
                  value: platform.id
                })),
                default: configPlatforms.data.map(platform => platform.id)
              }
            ])
            .then(choices => {
              const filteredPlatforms = platforms
                .filter(platform => choices.platforms.includes(platform.id))
                .map(platform => {
                  delete platform.games;
                  return platform;
                });
              return Promise.resolve(filteredPlatforms);
            });
        });
      }
    },
    {
      title: 'Saving platform info',
      execute: (progress, prev: LocalPlatform[]) => {
        progress('started', 0, 1);
        return configPlatforms.save(prev).then(() => {
          progress('done', 1, 1);
        });
      }
    }
  );
});
