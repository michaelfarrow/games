import { steps, ProgressFunc } from './lib/ui';
import axios from 'axios';
import fs from 'fs-extra';
import download from 'download';
import path from 'path';
import yauzl from 'yauzl-promise';

const DOWNLOAD_DIR = '.config/openVGDB';
const API_URL =
  'https://api.github.com/repos/OpenVGDB/OpenVGDB/releases?page=1&per_page=1';
const ZIP_NAME = 'openvgdb.zip';
const META_FILE = 'openvgdb.json';
const DB_FILE_NAME = 'openvgdb.sqlite';

const ensureDir = () => fs.ensureDir(DOWNLOAD_DIR);

const getRelease = () =>
  axios.get(API_URL).then(res => (res.data && res.data[0]) || null);

const checkRelease = (release: any) => {
  if (!release)
    return Promise.reject(new Error('Could not find remote release'));
  if (!release.assets || !release.assets.length)
    return Promise.reject(new Error('Could not find remote release assets'));
  const asset = release.assets.find(asset => asset.name === ZIP_NAME);
  if (!asset || !asset.browser_download_url)
    return Promise.reject(new Error('Could not find remote release zip asset'));
  return Promise.resolve({
    tag: release.tag_name,
    url: asset.browser_download_url
  });
};

const downloadRelease = (progress: ProgressFunc) => (release: {
  tag: string;
  url: string;
}) => {
  return fs
    .readJson(path.resolve(DOWNLOAD_DIR, META_FILE), { throws: false })
    .catch(e => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    })
    .then(meta => {
      if (!meta || meta.tag !== release.tag) {
        return download(release.url, DOWNLOAD_DIR, {
          filename: ZIP_NAME
        })
          .on('response', res => {
            const total = res.headers['content-length'];
            let done = 0;
            res.on('data', data => {
              done += data.length;
              progress(
                `Downloading OpenVGDB ${release.tag}`,
                Math.round(done / 1024),
                Math.round(total / 1024)
              );
            });
          })
          .then(() =>
            fs.outputJSON(path.resolve(DOWNLOAD_DIR, META_FILE), {
              tag: release.tag
            })
          );
      }
      progress('OpenVGDB is already the latest version');
    });
};

const downloadOpenVGDB = (progress: ProgressFunc) => {
  progress('Finding release');
  return ensureDir()
    .then(getRelease)
    .then(checkRelease)
    .then(downloadRelease(progress));
};

const unzipOpenVGDB = (progress: ProgressFunc) => {
  progress('Reading zip file contents');
  const zipPath = path.resolve(DOWNLOAD_DIR, ZIP_NAME);
  return yauzl.open(zipPath).then(zipFile => {
    return zipFile.readEntries().then(entries => {
      const entry = entries.find(entry => entry.fileName === DB_FILE_NAME);
      if (!entry)
        return Promise.reject(new Error('Cannot find database file in zip'));
      const size = entry.uncompressedSize;
      progress('Extracting zip', 0, Math.round(size / 1024 / 1024));
      return entry.openReadStream().then(readStream => {
        return new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(
            path.resolve(DOWNLOAD_DIR, DB_FILE_NAME)
          );
          let written = 0;
          readStream.on('data', data => {
            writeStream.write(data, () => {
              written += data.length;
              progress(
                'Extracting zip',
                Math.round(written / 1024),
                Math.round(size / 1024)
              );
              if (written === size) {
                writeStream.close();
              }
            });
          });
          writeStream.on('close', resolve);
          writeStream.on('error', err => reject(err));
        });
      });
    });
  });
};

steps(
  {
    title: 'Downloading OpenVGDB Database',
    execute: downloadOpenVGDB
  },
  {
    title: 'Unzipping OpenVGDB Database',
    execute: unzipOpenVGDB
  }
);
