const fs = require('fs');
const PDFDocument = require('./pdfKitWithTables.js');
const nodeUtil = require('util')
const EventEmitter = require('events').EventEmitter
const klaw = require('klaw')
const path = require('path')
const util = require('./util.js')

let _self

function log(level, message) { _self.emit("log",{module:'manifest',level,message})}
// TODO: put function in util lib
function trim(string, maxLength, addThingyToEnd) {
  if (!string || !string.length) return string
  if (string.length < maxLength) return string
  else {
    if (addThingyToEnd) return `${string.substring(0, maxLength-4)}...`
    else return string.substring(0, maxLength)
  }
}
function getValueCSV(text) {
  if (!text || !text.length) return ''
  if (text.includes(',')) return `"${text}"`
  return text
}

class Manifest {
  constructor() {
    _self = this
    EventEmitter.call(this)
  }
  types = ['pdf','csv','html']
  // TODO: check for proper type first
  async handler(event) {
    const media = await this.scanDirs(event.dirs, event.source)
    switch(event.type) {
      case 'pdf': {
        await this.generatePdf(event.source, media)
      } break
      case 'csv': {
        await this.generateCsv(event.source, media)
      } break
      case 'html': {
        throw 'unimplemented'
      } break
    }
    //await this.generateManifest(event.source, media)
    log('info', 'thing probably complete')
    return
  }
  async generateCsv(source, media) {
    if (source === 'imdb') {
      let csv = `Title,Type,Active,Season,Description,Genres,Stars,ParentalRating,ReleaseYear,IMDBRating,Runtime,Director,Creator,ImageUrl,\n`
      for (const prop in media) {
        console.log('on prop', prop)
        const title = getValueCSV(media[prop].title)
        const type = media[prop].type
        const desc = getValueCSV(media[prop].description)
        const genres = getValueCSV(media[prop].genres.join(','))
        const stars = getValueCSV(media[prop].stars.join(','))
        const pRating = getValueCSV(media[prop].parentalRating)
        const releaseYr = getValueCSV(media[prop].releaseYear)
        const imdbRating = getValueCSV(media[prop].imdbRating)
        const runtime = getValueCSV(media[prop].runtime)
        const director = getValueCSV(media[prop].director)
        const creator = getValueCSV(media[prop].creator)
        const imageUrl = getValueCSV(media[prop].imageUrl)
        if (type === 'TV Series') {
          for (let i = 0; i < media[prop].seasons.length; i++) {
            csv += `${title},${type},${media[prop].seasons[i].isActive},${media[prop].seasons[i].season},${desc},${genres},${stars},${pRating},${releaseYr},${imdbRating},${runtime},${director},${creator},${imageUrl},\n`
          }
        } else {
          csv += `${title},${type},${media[prop].isActive},N/A,${desc},${genres},${stars},${pRating},${releaseYr},${imdbRating},${runtime},${director},${creator},${imageUrl},\n`
        }

      }
      fs.writeFileSync('imdb.csv', csv, {encoding:'utf8'})
      console.log('thing written to same dir')
    } else if (source === 'myanimelist') {
      throw 'unimplemented'
    }
  }
  async generatePdf(source, media) {
    if (source === 'imdb') {
      throw 'unimplemented'
    } else if (source === 'myanimelist') {
      const maxChars = 105;
      const doc = new PDFDocument({margin:10})
      doc.pipe(fs.createWriteStream('mal.pdf'))
      const table = { headers: ['Cover', 'Titles 1,2', 'Year, Ep ct, dur', 'rating, genre', 'description'], rows: [] }
      for (const prop in media) {
        // I got fucked up data due to MAL blocking my IP for scraping. FUCK THEM!
        // Check if the title is set due to that.
        if (media[prop].title && media[prop].title.length) {
          const pathObj = path.parse(media[prop].jsonPath)
          const imagePath = path.join(pathObj.dir, 'metadata', media[prop].coverImage)

          let row1 = trim(`-${media[prop].title}\n-${media[prop].titleEnglish}`, 80);
          let row2 = trim(`${media[prop].premiered ? media[prop].premiered : media[prop].aired}\nEPS: ${media[prop].episodes}\n${media[prop].duration}\nTYPE: ${media[prop].type}`, maxChars)
          let row3 = trim(`${trim(media[prop].rating,7)}\n${media[prop].genres.join(', ')}`, 80)
          let row4 = trim(media[prop].description, maxChars, true)
          const row = [
            {
              type: 'image',
              path: imagePath,
            },
            {
              type: 'link',
              text: row1,
              url: media[prop].url,
            },
            row2,
            row3,
            row4
          ]
          log('debug', `row: ${JSON.stringify(row)}`)
          table.rows.push(row)
        }
      }

      // TODO: attempt to pass image settings here
      doc.table(table, {
        prepareHeader: () => doc.font('Helvetica-Bold'),
        prepareRow: (row, i) => doc.font('Helvetica').fontSize(12)
      })
      doc.end()
    }
    return
  }
  async scanDirs(dirs, source) {
    const media = {}
    for (let i = 0; i < dirs.length; i++) {
      const p = new Promise((resolve, reject) => {
        const result = {}
        const coverImages = []
        klaw(dirs[i])
        .on('data', item => {
          const thing = path.parse(item.path)
          if (thing.base.toLowerCase() === 'info.json') {
            const arr = thing.dir.replace(dirs[i], '').split('/')
            const mediaName = arr[arr.length-1]
            result[mediaName] = {
              jsonPath: item.path,
            }
          }
        })
        .on('end', () => {
          log('info', `found ${Object.keys(result).length} json files in dir '${dirs[i]}'`)
          resolve(result)
        })
      })
      const result = await p
      for (let prop in result) {
        // pull json files, build final result with data
        let data
        try {
          data = JSON.parse(Buffer.from(fs.readFileSync(result[prop].jsonPath)))
        } catch(err) {
          log('error', `'${result[prop].jsonPath}' invalid json`)
          continue
        }

        //try {
          if (!data.sources || !data.sources[source]) {
            log('debug', `source not defined: ${source}, path ${result[prop].jsonPath}`)
            continue
          }
          if (!data.sources[source].version == null || isNaN(data.sources[source].version)) {
            log('debug', `version incorrect: ${data.sources[source].version}, path ${result[prop].jsonPath}`)
            continue
          }
          if (!data.data || !data.data[`${source}_${data.sources[source].version}`]) {
            log('debug', `data missing, keys ${Object.keys(data.data).length}, intended key: 'source_${data.sources[source].version}', path ${result[prop].jsonPath}`)
            continue
          }
          media[prop] = data.data[`${source}_${data.sources[source].version}`]
          media[prop].jsonPath = result[prop].jsonPath
          media[prop].url = data.sources[source].url
        //} catch (err) { log('error', `'${result[prop].jsonPath}' incorrectly formatted json: ${JSON.stringify(err)}`) }
      }
      log('info', `Aggregated ${Object.keys(media).length} objects in directory '${dirs[i]}'`)
    }

    return media
  }
}

nodeUtil.inherits(Manifest, EventEmitter)

module.exports = Manifest
