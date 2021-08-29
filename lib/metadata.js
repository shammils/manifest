const cheerio = require('cheerio')
const nodeUtil = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const klaw = require('klaw')
const path = require('path')
const request = require('./request.js')
const url = require('url')
const dl = require('./download.js')
const util = require('./util.js')
// DL jsdom if the need arises

let _self
const maxDelay = 60000
// 0 -> 1, readded fucking url
const arbitrarySchemaVersion = '1'

function log(level, message) { _self.emit("log",{module:'metadata',level,message})}
const delay = ms =>
  new Promise(resolve =>
    setTimeout(() => resolve(), ms))

const getValue = ($, params) => {
  /*
    We support three types: innerText, nextElement, array
    innerText: The value is inside the parent not wrapped in an element
    nextElement: The value is in next element
    array: the values reside in a similar typed element inside the parent
  */
  switch (params.type) {
    case 'innerText': {
      //console.log('episodes', $(el).parent().text().replace(label,'').trim())
      const parent = $(params.el).parent()
      if (parent) {
        const text = parent.text()
        if (text && text.length)
          return text.replace(params.label,'').trim()
      }
    } break
    case 'nextElement': {
      // console.log('premeried', $(el).next().text())
      const nextEl = $(params.el).next()
      if (nextEl) return nextEl.text()
    } break
    case 'array': {
      const objects = []
      const parent = $(params.el).parent()
      if (parent) {
        parent.children().each((j, e) => {
          const object = $(e);
          if (object && object[0].name === params.elementType) {
            objects.push(object.text())
          }
        })
      }
      return objects
    } break
  }
}

class Metadata {
  constructor() {
    _self = this
    EventEmitter.call(this)
  }
  sources = [
    'imdb',
    'myanimelist'
  ]
  async handler(event) {
    if (event.update === true) log('info', 'All applicable directories will be updated')
    else log('info', 'Only unpopulated directories will be queued')

    for (let i = 0; i < event.dirs.length; i++) {

      log('info', `${i+1}/${event.dirs.length} on directory '${event.dirs[i]}'`)
      const metadataFiles = await this.scanDir(event.dirs[i], event.source, event.update)
      let json
      log('info',`'${metadataFiles.length}' applicable json files found`)

      for (let j = 0; j < metadataFiles.length; j++) {
        const html = Buffer.from(await request(metadataFiles[j].url)).toString('utf8')
        log('debug', `html ln: ${html.length}`)
        const result = await this.fetchMetadata(event.source, html, metadataFiles[j].url)
        log('debug', `metadata: ${JSON.stringify(result)}`)
        await delay(util.getRandomInt(maxDelay))

        await this.saveMetadata(event.source, result, metadataFiles[j].path, metadataFiles[j].data)
        log('info', `${j+1}/${metadataFiles.length} '${result.title}' updated`)
      }

    }
    return
  }

  async saveMetadata(source, dataFromWeb, originalPath, dataFromDisk) {
    // there will always be an existing json file
    const currentSource = dataFromDisk.sources[source]
    if (currentSource) {
      let version = parseInt(currentSource.version)
      if (isNaN(version)) {
        version = 0
        dataFromDisk.sources[source].createdDate = new Date().toISOString()
      }
      else version += 1
      // attempt to save image now the current version has been declared
      if (dataFromWeb.imageUrl) {
        const imageName = await this.saveImage(source, originalPath, dataFromWeb.imageUrl, version)
        await delay(util.getRandomInt(maxDelay))
        // START hacky special handling for fullsize IMDB images
        if (source === 'imdb' && dataFromWeb.imageUrl.includes('_V1_')) {
          const imageUrlObj = path.parse(dataFromWeb.imageUrl)
          if (imageUrlObj.name.includes('._V1_')) {
            const newUrl = path.join(imageUrlObj.dir, `${imageUrlObj.name.split('._V1_')[0]}._V1_${imageUrlObj.ext}`)
            await this.saveImage('full', originalPath, newUrl, version)
            await delay(util.getRandomInt(maxDelay))
          }
        }
        // END hack
        dataFromWeb.coverImage = imageName
        // going to keep this prop for debugging reasons for a while
        //delete result.imageUrl
      } else {
        log('warn', `failed to find image, url '${dataFromWeb.imageUrl}'`)
      }

      dataFromDisk.sources[source].version = version
      dataFromDisk.sources[source].updatedDate = new Date().toISOString()
      dataFromDisk.data[`${source}_${version}`] = dataFromWeb

      fs.writeFileSync(originalPath, JSON.stringify(dataFromDisk, ' ', 2), {encoding:'utf8'})

    } else {
      log('info', `data on disk does not define source '${source}'`)
    }
  }

  async saveImage(source, jsonPath, imageUrl, version) {
    const pathObj = path.parse(jsonPath)
    const imageUrlObj = path.parse(imageUrl)
    const metadataPath = path.join(pathObj.dir, 'metadata')
    const imageName = `cover_${source}_${version}${imageUrlObj.ext.toLowerCase()}`
    const imagePath = path.join(metadataPath, imageName)
    this.ensureDir(metadataPath)
    await dl({
      url: imageUrl,
      path: imagePath,
    })
    return imageName
  }
  ensureDir(dir) {
    try {
      fs.mkdirSync(dir)
    } catch(err) {
      if (err.code !== 'EEXIST') throw err
    }
    return
  }
  async fetchMetadata(source, html, url) {
    // we know the type exists at this point
    const $ = cheerio.load(html)

    if (source === 'myanimelist') {
      // get cover image
      //console.log($('#content > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > div:nth-child(1) > div:nth-child(1) > a:nth-child(1) > img:nth-child(1)').attr('data-src'))
      const result = {
        schemaVersion: arbitrarySchemaVersion,
        date: new Date().toISOString(),
        title: $('.title-name strong').text(),
        titleEnglish: $('.title-english').text(),
        description: $('p[itemprop=description]').text(),
        imageUrl: $('#content img').attr('data-src'),
        score: $('.score-label').text(),
      }
      $('.dark_text').each((i, el) => {
        const label = $(el).text()
        switch(label) {
          case 'Episodes:':  { result.episodes      = getValue($,{type:'innerText',el,label}) } break
          case 'Status:':    { result.status        = getValue($,{type:'innerText',el,label}) } break
          case 'Aired:':     { result.aired         = getValue($,{type:'innerText',el,label}) } break
          case 'Source:':    { result.sources       = getValue($,{type:'innerText',el,label}) } break
          case 'Duration:':  { result.duration      = getValue($,{type:'innerText',el,label}) } break
          case 'Rating:':    { result.rating        = getValue($,{type:'innerText',el,label}) } break
          case 'Synonyms:':  { result.synonyms      = getValue($,{type:'innerText',el,label}) } break
          case 'Japanese:':  { result.titleJapanese = getValue($,{type:'innerText',el,label}) } break
          case 'English:':   { result.titleOther    = getValue($,{type:'innerText',el,label}) } break
          case 'Type:':      { result.type          = getValue($,{type:'nextElement',el,label}) } break
          case 'Premiered:': { result.premiered     = getValue($,{type:'nextElement',el,label}) } break
          case 'Producers:': { result.producers     = getValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Licensors:': { result.licensors     = getValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Studios:':   { result.studios       = getValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Genres:':    { result.genres        = getValue($,{type:'array',elementType:'a',el,label}) } break
        }
      })
      return result
    } else if (source === 'imdb') {
      const result = {
        schemaVersion: arbitrarySchemaVersion,
        type: null,
        date: new Date().toISOString(),
        title: $('h1[data-testid=hero-title-block__title]').text(),
        description: $('span[data-testid=plot-xl]').text(),
        imageUrl: $('.ipc-image').attr('src'),
        genres: [],
        stars: [],
      }
      const ratingParent = $('div[data-testid=hero-rating-bar__aggregate-rating__score]')
      ratingParent.children().each((i, e) => {
        const object = $(e);
        if (i === 0) result.parentalRating = object.text()
      })
      $('.ipc-inline-list__item').each((i, li) => {
        const text = $(li).text()
        if (text && text.length) {
          // doing this under season handling is cleaner
          /*if (i === 0) {
            if (text === 'TV Series') result.type = text
            else result.type = 'Movie'
          }*/
          console.log('debug', `${i}, ${text}`)
          if (text.includes('min') && text.length < 10) result.runtime = text
        }
        $(li).children().each((j, c) => {
          const child = $(c)
          if (child[0].name === 'a') {
            const href = child.attr('href')
            if (href.includes('releaseinfo?ref_=tt_ov_rdat#releases')) result.releaseYear = child.text()
            if (href.includes('releaseinfo?ref_=tt_dt_rdat')) result.USReleaseDate = child.text()
            if (href.includes('parentalguide')) result.imdbRating = child.text()
            if (href.endsWith('?ref_=tt_ov_dr')) result.director = text
            if (href.endsWith('?ref_=tt_ov_wr')) result.creator = text
            if (href.endsWith('?ref_=tt_ov_st') && !result.stars.includes(child.text())) result.stars.push(child.text())
            console.log('debug', child.attr('href'))
          }
        })
      })
      $('div[data-testid=genres]').children().each((i, c) => {
        const a = $(c)
        if (a && a.attr('href').includes('/search/title?genres=')) result.genres.push(a.text())
      })
      // Season handling
      const season = $('#browse-episodes-season')
      if (season) {
        result.type = "TV Series"
        result.seasons = []
        const count = parseInt(season.attr('aria-label'))
        for (let i = 0; i < count; i++) {
          result.seasons.push({
            season: i+1,
            isActive: false,
          })
        }
      } else {
        result.type = 'Movie'
      }
      return result
    }
  }

  // TODO: split this method up to reuse code
  async scanDir(dir, source, update) {
    const jobs = []
    const p = new Promise((resolve, reject) => {
      const paths = []
      klaw(dir)
      .on('data', item => {
        const thing = path.parse(item.path)
        if (thing.base.toLowerCase() === 'info.json') {
          paths.push(item.path)
        }
      })
      .on('end', () => {
        resolve(paths)
      })
    })
    const paths = await p
    for (let i = 0; i < paths.length; i++) {
      try {
        const metadata = JSON.parse(
          Buffer.from(
            fs.readFileSync(paths[i])
          ).toString('utf8')
        )
        await delay(100)
        if (!metadata.sources[source]) {
          log('info', `metadata file does not support source ${source}, path '${paths[i]}'`)
          continue
        }
        if (!metadata.sources[source].url || !metadata.sources[source].url.length) {
          log('warn', `json at path '${paths[i]}' exists but url not populated`)
          continue
        }

        let addJobToQueue = false
        // always refetch if update set to true(in the future will be named overwrite)
        if (update === true) addJobToQueue = true
        // update if version is null(not an int). the date values will also be null on new files
        else if (isNaN(metadata.sources[source].version)) addJobToQueue = true
        // update if version and data doesnt match. not sure how this can happen, I probably shouldnt plan for this
        else if (!isNaN(metadata.sources[source].version) &&
          !metadata.data[`${source}_${metadata.sources[source].version}`]) addJobToQueue = true
        if (addJobToQueue) jobs.push({
          path: paths[i],
          url: metadata.sources[source].url,
          data: metadata
        })

      } catch(err) {
        log('error', `'${paths[i]}' invalid json`)
      }
    }
    return jobs
  }
}

nodeUtil.inherits(Metadata, EventEmitter)

module.exports = Metadata
