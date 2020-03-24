import sqlite3 from 'sqlite3';
import map from 'lodash/map';
import { escape } from 'sqlstring-sqlite';

const DB_FILE_PATH = '.config/openVGDB/openvgdb.sqlite';

export type Platform = {
  id: number;
  name: string;
  shortName: string;
};

export type Region = {
  id: number;
  name: string;
};

export type Game = {
  id: number;
  name: string;
  region: number;
  platform: number;
  description?: string;
  released?: string;
  cover?: string;
  romHash?: string;
  romFile?: string;
};

export type Join = {
  table: string;
  type: 'inner' | 'left' | 'cross';
  on?: string;
}; // Properly type this, on only neccessary on inner on left

export type Query<T> = {
  select: { [key in keyof T]?: string };
  from: string;
  where?: { [key in keyof T]?: string[] | string | number | number[] };
  limit?: [number, number];
  join?: Join[];
};

export class OpenVGDB {
  db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  private all<T>(query: Query<T>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(this.buildQuery<T>(query), (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  buildQuery<T>(query: Query<T>): string {
    const fields = map(query.select, (from, to) => {
      return `${from} AS ${to}`;
    });
    const queryStr = [`SELECT ${fields.join(', ')}`, `FROM ${query.from}`];
    if (query.join && query.join.length) {
      const joins = query.join
        .map(join => {
          if (join.type === 'inner' && join.on) {
            return `INNER JOIN ${join.table} ON ${join.on}`;
          } else if (join.type === 'left' && join.on) {
            return `LEFT OUTER JOIN ${join.table} ON ${join.on}`;
          } else if (join.type === 'cross') {
            return `CROSS JOIN ${join.table}`;
          }
          return null;
        })
        .filter(j => !!j);
      if (joins.length) queryStr.push(joins.join(' '));
    }
    if (query.where)
      queryStr.push(
        `WHERE ${map(query.where, (val, field) => {
          if (Array.isArray(val) && !val.length) return;
          const vals = Array.isArray(val) ? val : [val];
          const isString = typeof vals[0] === 'string';
          const escapedVals = vals
            .map(escape)
            .map(val => (isString ? `"${val}"` : val));
          return `${field} IN (${escapedVals.join(', ')})`;
        })
          .filter(where => !!where)
          .join(' AND ')}`
      );
    return queryStr.join(' ');
  }

  platforms(): Promise<Platform[]> {
    return this.all<Platform>({
      select: {
        id: 'systemID',
        name: 'systemName',
        shortName: 'systemShortName'
      },
      from: 'systems'
    });
  }

  regions(): Promise<Region[]> {
    return this.all<Region>({
      select: {
        id: 'regionID',
        name: 'regionName'
      },
      from: 'regions'
    });
  }

  regionGames(regions: Region[] | Region | null | undefined): Promise<Game[]> {
    if (!regions) return Promise.resolve([]);
    const _regions: Region[] = Array.isArray(regions) ? regions : [regions];
    if (!_regions.length) return Promise.resolve([]);
    return this.all<Game>({
      select: {
        id: 'releaseID',
        name: 'releaseTitleName',
        region: 'regionLocalizedID',
        cover: 'releaseCoverFront',
        description: 'releaseDescription',
        released: 'releaseDate',
        platform: 'systemID',
        romHash: 'romHashSHA1'
      },
      from: 'releases',
      join: [
        {
          table: 'roms',
          type: 'inner',
          on: 'roms.romID = releases.romID'
        }
      ],
      where: {
        region: _regions.map(region => region.id)
      }
    });
  }
}

const loadDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      DB_FILE_PATH,
      sqlite3.OPEN_READONLY,
      err => {
        if (err) return reject(err);
        resolve(db);
      }
    );
  });
};

export default function openVGDB(): Promise<OpenVGDB> {
  return loadDatabase().then(db => new OpenVGDB(db));
}
