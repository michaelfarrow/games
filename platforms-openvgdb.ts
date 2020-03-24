import { steps, ProgressFunc } from './lib/ui';
import openVGDB, { OpenVGDB, Platform } from './lib/openVGDB';
import inquirer from 'inquirer';
import configPlatforms from './lib/config-platforms';
import clear from 'console-clear';

const getPlatforms = (
  progress: ProgressFunc,
  db: OpenVGDB
): Promise<Platform[]> => {
  return db.platforms();
};

const askForPlatforms = (defaultPlatforms: Platform[]) => (
  progress: ProgressFunc,
  platforms: Platform[]
): Promise<Platform[]> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      clear(true);
      inquirer
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
            default: defaultPlatforms.map(platform => platform.id)
          }
        ])
        .then(choices =>
          Promise.resolve(
            platforms.filter(platform =>
              choices.platforms.includes(platform.id)
            )
          )
        )
        .then(resolve)
        .catch(reject);
    }, 100);
  });
};

const savePlatforms = (config: typeof configPlatforms) => (
  progress: ProgressFunc,
  platforms: Platform[]
): Promise<void> => {
  return config.save(platforms);
};

configPlatforms.load().then(configPlatforms => {
  return steps(
    {
      title: 'Loading database',
      execute: openVGDB
    },
    {
      title: 'Get platforms',
      execute: getPlatforms
    },
    {
      title: 'Select platforms',
      execute: askForPlatforms(configPlatforms.data)
    },
    {
      title: 'Save platforms',
      execute: savePlatforms(configPlatforms)
    }
  );
});
