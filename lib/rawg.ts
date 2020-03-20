import axios from 'axios';
import { cacheGetSet } from './cache';
import _ from 'lodash';

const PER_PAGE = 40;

const api = axios.create({
  baseURL: 'https://api.rawg.io/api',
  headers: {
    Accept: 'application/json',
    'User-Agent': 'dunstable'
  }
});

type ResponseMulti<T> = {
  count: number;
  next?: string;
  prev?: string;
  results: T[];
};

export const request = <T = any>(
  path: string,
  params: { [key: string]: any } = {},
  progress: (percent: number) => void = null,
  page: number = 1,
  allItems: T[] = []
): Promise<T[]> => {
  if (page === 1) progress && progress(0);
  return cacheGetSet<ResponseMulti<T>>(
    `rawg ${path} ${page} ${PER_PAGE} ${_.map(
      params,
      (v, k) => `${k}:${v}`
    ).join(', ')}`,
    () => {
      return api
        .get(path, {
          params: {
            page: page,
            page_size: PER_PAGE,
            ...params
          }
        })
        .then(res => res.data);
    }
  ).then(data => {
    allItems = allItems.concat(data.results);
    progress && progress(allItems.length / data.count);
    if (!data.next) return Promise.resolve(allItems);
    return request<T>(path, params, progress, page + 1, allItems);
  });
};

export const requestSingle = <T = any>(path, params = {}): Promise<T> => {
  return cacheGetSet<T>(
    `rawg single ${path} ${_.map(params, (v, k) => `${k}:${v}`).join(', ')}`,
    () => {
      return api
        .get(path, {
          params
        })
        .then(res => res.data);
    }
  );
};
