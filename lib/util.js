const fs = require('fs')
const klaw = require('klaw')
const path = require('path')
const sizeOf = require('image-size')

const api = {
  getRandomInt: (max) => {
    return Math.floor(Math.random() * max)
  },
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
}
module.exports = api
