import fs from 'fs-extra';

class Config<T> {
  path: string;
  defaultVal: T;
  data: T;

  constructor(id: string, defaultVal: T) {
    this.path = `./.config/${id}.json`;
    this.defaultVal = defaultVal;
  }

  load(): Promise<Config<T>> {
    return fs
      .readJson(this.path)
      .then(data => {
        this.data = data;
        return this;
      })
      .catch(e => {
        if (e.code === 'ENOENT') {
          this.data = this.defaultVal;
          return this;
        }
        throw e;
      });
  }

  save(data: T): Promise<void> {
    return fs.outputJSON(this.path, data || this.data, { spaces: 2 });
  }
}

const config = <T>(id: string, defaultVal: T) => new Config<T>(id, defaultVal);

export default config;
