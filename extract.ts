import { steps } from './lib/ui';
import klaw from 'klaw';
import path from 'path';
import pEachSeries from 'p-each-series';
import fs from 'fs-extra';
import yauzl from 'yauzl-promise';
import unrar from 'unrar.js';
import _ from 'lodash';

const ROMS_DIR = './roms';
const ROMS_DIR_FILTERED = './roms-filtered';

type UnpackFunc = (archive: Archive) => Promise<void>;

type ArchiveConfig = {
  extensions: string[];
  unpack: UnpackFunc;
};

type Archive = {
  file: string;
  dest: string;
};

const unpackZip = (archive: Archive): Promise<any> => {
  return yauzl.open(archive.file).then(zipFile => {
    return zipFile.readEntries().then(entries => {
      return pEachSeries(entries, entry => {
        // ignore directories
        if (entry.fileName.match(/\/$/)) return Promise.resolve();
        const destPath = path.resolve(archive.dest, entry.fileName);
        return fs.pathExists(destPath).then(exists => {
          if (exists) return Promise.resolve();
          const destDir = path.dirname(destPath);
          return fs.ensureDir(destDir).then(() => {
            return entry.openReadStream().then(readStream => {
              return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(destPath);
                writeStream.on('close', () => resolve());
                writeStream.on('error', err => reject(err));
                readStream.pipe(writeStream);
              });
            });
          });
        });
      });
    });
  });
};

const unpackRar = (archive: Archive): Promise<any> => {
  return new Promise((resolve, reject) => {
    const res = unrar.unrarSync(archive.file, archive.dest);
    resolve();
    // unrar.unrar(archive.file, archive.dest, {}, err => {
    //   if (err) return reject(err);
    //   resolve();
    // });
  });
};

const archiveConfig: ArchiveConfig[] = [
  {
    extensions: ['.zip'],
    unpack: unpackZip
  }
  // {
  //   extensions: ['.rar'],
  //   unpack: unpackRar
  // }
];

const getFiles = (): Promise<string[]> => {
  const items = [];
  // const extensions = _.flatten(archiveConfig.map(c => c.extensions));
  return new Promise((resolve, reject) => {
    klaw(ROMS_DIR)
      .on('error', err => {
        reject(err);
      })
      .on('data', item => {
        if (!item.stats.isFile()) return;
        items.push(item.path);
        // const ext = path.extname(item.path);
        // if (extensions.includes(ext)) items.push(item.path);
      })
      .on('end', () => {
        resolve(items);
      });
  });
};

const processFile = (p: string): Promise<any> => {
  const sourceDir = path.resolve(__dirname, ROMS_DIR);
  const destDir = path.resolve(__dirname, ROMS_DIR_FILTERED);
  const destFilePath = `${destDir}${p.substr(sourceDir.length)}`;
  let destFileDir = destFilePath;
  const ext = path.extname(p);
  const _archiveConfig = archiveConfig.find(c => c.extensions.includes(ext));
  if (_archiveConfig) {
    return fs.ensureDir(destFileDir).then(() => {
      return _archiveConfig
        .unpack({
          file: p,
          dest: destFileDir
        })
        .catch(err => {
          err.message = `Error processing archive: ${err.message}\nFile: ${p}`;
          throw err;
        });
    });
  }
  destFileDir = path.dirname(destFilePath);
  return fs.ensureDir(destFileDir).then(() => {
    return fs.pathExists(destFilePath).then(exists => {
      if (exists) return Promise.resolve();
      return fs.copyFile(p, destFilePath);
    });
  });
};

// const getPlaformDirs = (): Promise<string[]> => {
//   const filteredRomDir = path.resolve(__dirname, ROMS_DIR_FILTERED);
//   const dirs = [];
//   return new Promise((resolve, reject) => {
//     klaw(ROMS_DIR_FILTERED, { depthLimit: 0 })
//       .on('error', err => {
//         reject(err);
//       })
//       .on('data', item => {
//         if (!item.stats.isDirectory() || item.path === filteredRomDir) return;
//         dirs.push(item.path);
//       })
//       .on('end', () => {
//         resolve(dirs);
//       });
//   });
// };

steps(
  {
    title: 'Getting files',
    execute: progress => {
      progress('starting', 0, 1);
      return getFiles().then(res => {
        progress('done', 1, 1);
        return res;
      });
    }
  },
  // TODO: handle uncompressed files
  {
    title: 'Unpacking archives and copying files',
    execute: (progress, prev: string[]) => {
      return pEachSeries(prev, (p, i) => {
        const sourceDir = path.resolve(__dirname, ROMS_DIR);
        const filePath = p.substr(sourceDir.length);
        progress(filePath, i, prev.length);
        return processFile(p).then(() => {
          progress(filePath, i + 1, prev.length);
        });
      });
    }
  }
  // {
  //   title: 'Getting platform directories',
  //   execute: progress => {
  //     progress('starting', 0, 1);
  //     return getPlaformDirs().then(res => {
  //       progress('done', 1, 1);
  //       console.log(res);
  //       return res;
  //     });
  //   }
  // }
  // {
  //   title: 'Getting platform files',
  //   execute: (progress, dirs: string[]) => {
  //     progress('starting', 0, 1);
  //     return getPlaformDirs().then(res => {
  //       progress('done', 1, 1);
  //       console.log(res);
  //       return res;
  //     });
  //   }
  // }
);
