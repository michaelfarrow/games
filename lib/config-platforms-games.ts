import config from './config';
import { Platform, Game } from './openVGDB';

export type PlatformWithGames = Platform & {
  games: Game[];
};

export default config<PlatformWithGames[]>('platforms-games-openvgdb', []);

export const configFiltered = config<PlatformWithGames[]>(
  'platforms-games-filtered-openvgdb',
  []
);
