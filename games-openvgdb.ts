import { steps, ProgressFunc } from './lib/ui';
import openVGDB, { OpenVGDB, Platform, Region, Game } from './lib/openVGDB';
import configPlatforms from './lib/config-platforms';
import configPlatformsWithGames, {
  PlatformWithGames
} from './lib/config-platforms-games';

const REGIONS = ['USA'];

const fetchRegions = (
  progress: ProgressFunc,
  db: OpenVGDB
): Promise<{ db: OpenVGDB; regions: Region[] }> => {
  return db.regions().then(regions => ({ db, regions }));
};

const filterRegions = (
  progress: ProgressFunc,
  prev: { db: OpenVGDB; regions: Region[] }
): Promise<{ db: OpenVGDB; regions: Region[] }> => {
  const acceptedRegions = REGIONS.map(r => r.trim().toLowerCase());
  return Promise.resolve({
    ...prev,
    regions: prev.regions.filter(region =>
      acceptedRegions.includes(region.name.trim().toLowerCase())
    )
  });
};

const fetchRegionGames = (
  progress: ProgressFunc,
  prev: { db: OpenVGDB; regions: Region[] }
): Promise<{ db: OpenVGDB; regions: Region[]; games: Game[] }> => {
  return prev.db.regionGames(prev.regions).then(games => ({
    ...prev,
    games
  }));
};

const mapGames = (platforms: Platform[]) => (
  progress: ProgressFunc,
  prev: { db: OpenVGDB; regions: Region[]; games: Game[] }
): Promise<PlatformWithGames[]> => {
  return Promise.resolve(
    platforms.map(platform => ({
      ...platform,
      games: prev.games.filter(game => game.platform === platform.id)
    }))
  );
};

const saveGames = (
  progress: ProgressFunc,
  platforms: PlatformWithGames[]
): Promise<void> => {
  return configPlatformsWithGames.save(platforms);
};

configPlatforms.load().then(configPlatforms => {
  return steps(
    {
      title: 'Loading database',
      execute: openVGDB
    },
    {
      title: 'Fetching regions',
      execute: fetchRegions
    },
    {
      title: 'Filtering regions',
      execute: filterRegions
    },
    {
      title: 'Fething region games',
      execute: fetchRegionGames
    },
    {
      title: 'Map games',
      execute: mapGames(configPlatforms.data)
    },
    {
      title: 'Save games',
      execute: saveGames
    }
  );
});
