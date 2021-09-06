const fs = require('fs-extra')
const klaw = require('klaw')
const path = require('path')
const sizeOf = require('image-size')
const {
  prng,
} = require('crypto');

const api = {
  getRandomInt: (max) => {
    return Math.floor(Math.random() * max)
  },
  uuid: () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
  .replace(/[018]/g, b =>
    (((b ^ prng(1)[0]) % 16) >> (b / 4)).toString(16)),
  delay: ms =>
  new Promise(resolve =>
    setTimeout(() => resolve(), ms)),
  ensureDir: () => {
    try {
      fs.mkdirSync(dir)
    } catch(err) {
      if (err.code !== 'EEXIST') throw err
    }
    return
  },
  getImageSize: async (imgPath) => {
    const supportedFileTypes = [
      'BMP',
      'CUR',
      'DDS',
      'GIF',
      'ICNS',
      'ICO',
      'JPG',
      'JPEG',
      'KTX',
      'PNG',
      'PNM',
      'PAM' ,
      'PBM',
      'PFM',
      'PGM',
      'PPM',
      'PSD',
      'SVG',
      'TIFF',
      'WebP',
    ];
    if (!fs.existsSync(imgPath)) {
      throw `file '${imgPath}' does not exist`
    }
    const obj = path.parse(imgPath);
    if (!supportedFileTypes.some(type => {
      return `.${type.toLowerCase()}` === obj.ext.toLowerCase()
    })) {
      throw `file type '${obj.ext}' unsupported`;
    }
    return new Promise((resolve, reject) => {
      sizeOf(imgPath, (err, dimensions) => {
        if (err) {
          // for now, we will assume the file is corrupt
          reject(Object.assign(err, {
            code: 'INVALID'
          }));
        } else {
          resolve(dimensions)
        }
      });
    })
  },
  writeToLog: (logPath, logLevel, logMessage) => {
    fs.appendFileSync(logPath, `${new Date().toISOString()}-${logLevel.toUpperCase()}: ${logMessage}\n`)
  },
}
module.exports = api
