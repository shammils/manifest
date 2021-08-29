const http = require('http')
const https = require('https')
const Stream = require('stream').Transform
const fs = require('fs')

const api = (params) =>
  new Promise((resolve, reject) => {

    let client = http;
    if (params.url.startsWith('https')) client = https;
    client.request(params.url, (res) => {
      const data = new Stream()
      res.on('data', (chunk) => {
        data.push(chunk)
      })
      res.on('end', () => {
        fs.writeFileSync(params.path, data.read())
        resolve()
      })
    }).end()

  })

module.exports = api
