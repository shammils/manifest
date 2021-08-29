const fs = require('fs')
const klaw = require('klaw')
const util = require('./lib/util.js')
const path = require('path')

const dir = '/path/to/metadata_files'

init()
async function init() {
  const images = []
  klaw(dir)
  .on('data', item => {
    const thing = path.parse(item.path)
    if (thing.name.startsWith('cover') && thing.dir.endsWith('metadata')) {
      images.push(item.path)
    }
  })
  .on('end', async () => {
    console.log('image count', images.length)
    for (let i = 0; i < images.length; i++) {
      try { await util.getImageSize(images[i]) }
      catch(err) { console.log(`fail`, images[i])}
    }
  })
}
