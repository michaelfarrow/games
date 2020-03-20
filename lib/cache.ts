import fs from 'fs-extra';
import crypto from 'crypto';
import path from 'path';

const CACHE_DIR = '.cache';

export const cacheGetSet = <T = any>(
  key: string,
  f: (key: string) => Promise<T>
): Promise<T> => {
  const hashedFilename = `${crypto
    .createHash('md5')
    .update(key)
    .digest('hex')}.json`;
  const cachePath = path.resolve(CACHE_DIR, hashedFilename);
  return fs.readJson(cachePath).catch(e => {
    if (e.code !== 'ENOENT') throw e;
    return f(key).then(res => {
      return fs.outputJSON(cachePath, res).then(() => res);
    });
  });
};
