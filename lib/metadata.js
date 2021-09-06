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

const getMalValue = ($, params) => {
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

// we once had 'getWikiLabelValue' but I hacked that instead. we still might have
// to support that one day
const getWikiCellValue = ($, prop, td) => {
  /*** handle simple text in root of thing ***/
  if (td.children.length === 1 && td.children[0].type === 'text') {
    return td.children[0].data
  }
  /*** HANDLE UNORDERED LISTS ***/
  if (td.children.length &&
  td.children[0].name === 'div' &&
  td.children[0].attribs.class === 'plainlist') {
    // loop children until you find ul
    for (let i = 0; i < td.children[0].children.length; i++) {
      if (td.children[0].children[i].name === 'ul') {
        const ul = $(td.children[0].children[i])
        const res = []
        $(ul).children().each((j, c) => {
          //console.log(`  ${j} - ${c.name} - ${c.children[0].type}/${c.children[0].name}`)
          if (c.children[0].type === 'text') res.push(c.children[0].data)
          if (c.children[0].name === 'a') res.push(c.children[0].children[0].data)
        })
        return res
      }
    }
  }

  /*** handle single a element ***/
  if (td.children.length === 1 &&
  td.children[0].name === 'a' &&
  td.children[0].children.length === 1 &&
  td.children[0].children[0].type === 'text') {
    return td.children[0].children[0].data
  }

  /*** Concatenate all text and a values in order ***/
  // if we encounter something outside of text, a, i and b, bail
  let looselyConcatenatedString
  let poisoned = false
  for (let i = 0; i < td.children.length; i++) {
    if (
    (td.children[i].name === 'a' || td.children[i].name === 'i' || td.children[i].name === 'b') &&
    td.children[i].children.length &&
    td.children[i].children[0].data &&
    td.children[i].children[0].data.length) {
      if (!looselyConcatenatedString) looselyConcatenatedString = td.children[i].children[0].data.trim()
      else looselyConcatenatedString += ` ${td.children[i].children[0].data.trim()}`
    } else if (td.children[i].type === 'text' && td.children[i].data.length) {
      if (!looselyConcatenatedString) looselyConcatenatedString = td.children[i].data.trim()
      else looselyConcatenatedString += ` ${td.children[i].data.trim()}`
    } else {
      // we dont care about BRs or HRs
      if (td.children[i].name !== 'br' && td.children[i].name !== 'hr') poisoned = true
    }
  }
  if (!poisoned) {
    //console.log(`--- ${prop}`)
    return looselyConcatenatedString
  }

  // im seeing different results when looping over children() vs children[], so
  // im keeping the below code just in case I need to switch between the two
  /*
  let looselyConcatenatedString
  let poisoned = false
  $(td).children().each((i, c) => {
    if ((c.name === 'a' || c.name === 'i' || c.name === 'b') && c.children[0].data.length) {
      if (!looselyConcatenatedString) looselyConcatenatedString = c.children[0].data.trim()
      else looselyConcatenatedString += ` ${c.children[0].data.trim()}`
      // shit, handle next
      const next = c.next
      if (next && next.type === 'text' && !looselyConcatenatedString.includes(next.data)) looselyConcatenatedString += ` ${next.data.trim()}`
    } else if (c.type === 'text' && c.data.length) {
      if (!looselyConcatenatedString) looselyConcatenatedString = c.data.trim()
      else looselyConcatenatedString += ` ${c.data.trim()}`
    } else {
      // we dont care about BRs or HRs
      if (c.name !== 'br' && c.name !== 'hr') poisoned = true
    }
  })
  if (!poisoned) return looselyConcatenatedString
  */

  /*** FETCH ALL TEXTS ***/
  // the case above this is much more ideal, but shit happens
  looselyConcatenatedString = undefined
  for (let i = 0; i < td.children.length; i++) {
    //console.log(`${i} - ${td.children[i].type}/${td.children[i].name}`)
    if (td.children[i].type === 'text' && td.children[i].data.length) {
      if (!looselyConcatenatedString) looselyConcatenatedString = td.children[i].data.trim()
      else looselyConcatenatedString += ` ${td.children[i].data.trim()}`
    }
  }
  if (looselyConcatenatedString) {
    return looselyConcatenatedString
  }

  /*** handle cases where the first element is text and the next element is ? ***/
  // dangerous because we could be skipping values. keep at the end
  if (td.children.length > 1 &&
    td.children[0].type === 'text') {
    log('warn', `!!! skipping all data after the first for prop "${prop}" !!!`)
    return td.children[0].data
  }
  log('warn', `--- failed to get anything for ${prop}`)
  return
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
        // HACK
        if (event.source === 'wikipedia') {
          // dont need to wait that long for wiki(I think)
          await delay(util.getRandomInt(10000))
        } else {
          await delay(util.getRandomInt(maxDelay))
        }

        await this.saveMetadata(event.source, result, metadataFiles[j].path, metadataFiles[j].data)
        log('info', `${j+1}/${metadataFiles.length} '${result.title}' updated (${metadataFiles[j].path})`)
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
          case 'Episodes:':  { result.episodes      = getMalValue($,{type:'innerText',el,label}) } break
          case 'Status:':    { result.status        = getMalValue($,{type:'innerText',el,label}) } break
          case 'Aired:':     { result.aired         = getMalValue($,{type:'innerText',el,label}) } break
          case 'Source:':    { result.sources       = getMalValue($,{type:'innerText',el,label}) } break
          case 'Duration:':  { result.duration      = getMalValue($,{type:'innerText',el,label}) } break
          case 'Rating:':    { result.rating        = getMalValue($,{type:'innerText',el,label}) } break
          case 'Synonyms:':  { result.synonyms      = getMalValue($,{type:'innerText',el,label}) } break
          case 'Japanese:':  { result.titleJapanese = getMalValue($,{type:'innerText',el,label}) } break
          case 'English:':   { result.titleOther    = getMalValue($,{type:'innerText',el,label}) } break
          case 'Type:':      { result.type          = getMalValue($,{type:'nextElement',el,label}) } break
          case 'Premiered:': { result.premiered     = getMalValue($,{type:'nextElement',el,label}) } break
          case 'Producers:': { result.producers     = getMalValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Licensors:': { result.licensors     = getMalValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Studios:':   { result.studios       = getMalValue($,{type:'array',elementType:'a',el,label}) } break
          case 'Genres:':    { result.genres        = getMalValue($,{type:'array',elementType:'a',el,label}) } break
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
        if (i === 0) result.imdbRating = object.text()
      })
      $('.ipc-inline-list__item').each((i, li) => {
        const text = $(li).text()
        if (text && text.length) {
          // doing this under season handling is cleaner
          /*if (i === 0) {
            if (text === 'TV Series') result.type = text
            else result.type = 'Movie'
          }*/
          //console.log('debug', `${i}, ${text}`)
          if (text.includes('min') && text.length < 10) result.runtime = text
        }
        $(li).children().each((j, c) => {
          const child = $(c)
          if (child[0].name === 'a') {
            const href = child.attr('href')
            if (href.includes('releaseinfo?ref_=tt_ov_rdat')) result.releaseYear = child.text()
            if (href.includes('releaseinfo?ref_=tt_dt_rdat')) result.USReleaseDate = child.text()
            if (href.includes('parentalguide')) result.parentalRating = child.text()
            if (href.endsWith('?ref_=tt_ov_dr')) result.director = text
            if (href.endsWith('?ref_=tt_ov_wr')) result.creator = text
            if (href.endsWith('?ref_=tt_ov_st') && !result.stars.includes(child.text())) result.stars.push(child.text())
            //console.log('debug', child.attr('href'))
          }
        })
      })
      $('div[data-testid=genres]').children().each((i, c) => {
        const a = $(c)
        if (a && a.attr('href').includes('/search/title?genres=')) result.genres.push(a.text())
      })
      // Season handling
      const season = $('#browse-episodes-season')
      if (season && season.length) {
        result.type = "TV Series"
        result.seasons = []
        const count = parseInt(season.attr('aria-label'))
        for (let i = 0; i < count; i++) {
          result.seasons.push({
            season: i+1,
          })
        }
      } else {
        result.type = 'Movie'
      }

      // 1960 TV show is missing rating, so assume if no rating exists, its G
      if (!result.parentalRating) result.parentalRating = 'G'
      else if (result.parentalRating === 'Add content advisory') {
        // TODO: create list of know ratings and if value isnt on there, set G
        result.parentalRating = 'G'
      }
      return result
    }
    else if (source === 'wikipedia') {
      const result = {
        schemaVersion: arbitrarySchemaVersion,
        date: new Date().toISOString(),
      }
      $('table.infobox.vevent tr').each((i, tr) => {
        const th = $(tr).children()[0]
        const td = $(tr).children()[1]
        //console.log(i)
        if (th.attribs.class === 'infobox-label') {
          let prop
          if (th.children.length) {
            for (let j = 0; j < th.children.length; j++) {
              // look for text value and exit if found. if div is found, attempt
              // extract text from it
              if (th.children[j].type === 'text') {
                prop = th.children[j].data
                break
              }
              if (th.children[j].name === 'div' && th.children[j].children.length) {
                // loop through div
                for (let k = 0; k < th.children[j].children.length; k++) {
                  if (th.children[j].children[k].type === 'text') {
                    prop = th.children[j].children[k].data
                    break
                  }
                }
                // check if prop was set and exit if so
                if (prop) break
              }
            }
          }

          if (!prop) {
            // old code that needs to die, but im leaving it here for whatever
            // for now
            if (th.children.length === 1) {
              prop = th.children[0].data
            } else if (th.children.length === 2) {
              prop = `Number${th.children[1].data}`
            }
          }

          if (th.children.length > 2 || prop === undefined) {
            /*
              https://en.wikipedia.org/wiki/Hawaii_Five-0_(2010_TV_series)
              has another infobox for audio info that I cannot cleanly ignore,
              so I have to not break on header failures any longer. will just
              write to log file

              Because of this, shit is going to get chaotic fucked since 'Producers'
              for the audio might overwrite 'Producers' for the actual show
            */
            log('warn', `failed to extract header`)
            //console.log(`shits fucked, figure it out. prop:'${prop}', url:'${url}'\n header obj:`, th)
            //process.exit(0)
          }
          //console.log( th.children[0].data )
          //console.log( td.children[0] )
          if (prop) {
            const val = getWikiCellValue($, prop, td)
            if (val) result[prop] = val
          }
          //process.exit(0)
        }
      })
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
