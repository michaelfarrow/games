export type BasePlatform = {
  id: number;
  name: string;
  slug: string;
  image_background?: string;
};

export type ApiPlatform = BasePlatform & {
  games?: ApiGame[];
};

export type LocalPlatform = BasePlatform & {
  games?: LocalGame[];
};

export type ApiGamePlatform = {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
};

export type Clip = {
  clip: string;
  clips: {
    '320': string;
    '640': string;
    full: string;
  };
  video: string;
  preview?: string;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  language: string;
};

export type Screenshot = {
  id: number;
  image: string;
};

export type BaseGame = {
  id: number;
  name: string;
  slug: string;
  released: string;
  background_image?: string;
  rating: number;
  clip?: Clip;
  short_screenshots?: Screenshot[];
};

export type ApiGame = BaseGame & {
  platforms?: ApiGamePlatform[];
  tags?: Tag[];
};

export type LocalGameDetail = {
  tags: string[];
  sort: string;
  singlePlayer: boolean;
  twoPlayer: boolean;
  mulitPlayer: boolean;
  description?: string;
  description_raw?: string;
  alternative_names?: string[];
};

export type LocalGame = BaseGame &
  LocalGameDetail & {
    platforms: number[];
  };

// export type MatchFile = {
//   full: string;
//   name: string;
//   ext: string;
//   match: string;
// };

export type Match = {
  // file: MatchFile;
  file: string;
  relPath: string;
  rating: number;
  altMatch: boolean;
};

export type PlatformMatch = {
  id: number;
  matched?: Match;
};

export type LocalMatchedGame = BaseGame &
  LocalGameDetail & {
    platforms: PlatformMatch[];
  };

export type ApiSingleGame = BaseGame & {
  description?: string;
  description_raw?: string;
  alternative_names?: string[];
};
