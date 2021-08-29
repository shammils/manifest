const { http, https } = require('follow-redirects');

const api = (url) =>
  new Promise((resolve, reject) => {
    let client = http
    if (url.startsWith('https')) client = https
    const req = client.request(url, res => {
      const body = [];
      res.on('data', body.push.bind(body));
      res.on('end', () => resolve(Buffer.concat(body)));
    });
    req.on('error', err => reject(err));
    req.end();
  });

module.exports = api;
