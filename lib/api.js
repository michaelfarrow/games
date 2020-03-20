const axios = require('axios');
const _ = require('lodash');

const PER_PAGE = 50;
const CHUNK_LIMIT = 4000;

const api = axios.create({
  baseURL: 'https://api-v3.igdb.com',
  headers: {
    Accept: 'application/json',
    'user-key': '49cad137cd5d833d56e0690b30fa5ab0'
  }
});

const request = (path, data, page = 0, allItems = []) => {
  // console.log(path, `limit ${PER_PAGE}; offset ${PER_PAGE * page}; ${data}`);
  return api
    .post(path, `limit ${PER_PAGE}; offset ${PER_PAGE * page}; ${data};`)
    .then(response => {
      const items = response.data;
      if (!items.length) return allItems;
      return request(path, data, page + 1, allItems.concat(items));
    });
};

const requestChunked = (items, f, chunk = 0, allItems = []) => {
  const chunkedItems = _.chunk(items, CHUNK_LIMIT);
  const chunked = chunkedItems[chunk];
  return f(chunked).then(returnedItems => {
    const newItems = allItems.concat(returnedItems || []);
    if (!chunkedItems[chunk + 1]) return newItems;
    return requestChunked(items, f, chunk + 1, newItems);
  });
};

const link = (items, path, data, from, to, map) => {
  let ids = [];
  items.forEach(item => {
    if (item[from]) {
      ids = ids.concat(Array.isArray(item[from]) ? item[from] : [item[from]]);
    }
  });
  ids = _.uniq(ids);
  if (!ids.length) return Promise.resolve([]);
  return requestChunked(ids, chunkedIds => {
    return request(
      path,
      `${data} where ${to} = (${chunkedIds.join(',')});  sort ${to} asc;`
    );
  }).then(linked => {
    return items.map(item => {
      if (item[from] === undefined || item[from] === null) return item;
      return {
        ...item,
        [from]: Array.isArray(item[from])
          ? linked
              .filter(linkedItem => {
                return item[from].includes(linkedItem[to]);
              })
              .map(linkedItem => (map ? map(linkedItem) : linkedItem))
          : linked.find(linkedItem => linkedItem[to] === item[from])
      };
    });
  });
};

module.exports = {
  request,
  link
};
