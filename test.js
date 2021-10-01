const Metadata = require('./lib/metadata.js')
const metadata = new Metadata()
const Manifest = require('./lib/manifest.js')
const manifest = new Manifest()
const fs = require('fs');
const PDFDocument = require('./lib/pdfKitWithTables.js');
const util = require('./lib/util.js')
const cheerio = require('cheerio')
const path = require('path')
const url = require('url')
const csv = require('csv')
const chalk = require('chalk')

metadata.on('log', log)
manifest.on('log', log)
function log(log) {
  switch (log.level) {
    case 'debug': {
      if (argv.debug)
        console.log(chalk.blue(`${new Date().toISOString()}: ${log.message}`))
    } break
    case 'info': { console.log(`${new Date().toISOString()}: ${log.message}`) } break
    case 'warn': { console.log(chalk.yellow(`${new Date().toISOString()}: ${log.message}`)) } break
    case 'error': { console.log(chalk.red(`${new Date().toISOString()}: ${log.message}`)) } break
    default:
      throw `unsupported log level ${log.level}`
  }
}

//h5o()
async function h5o() {
  let html = Buffer.from(
    fs.readFileSync('./temp/h5o.html')
  ).toString('utf8')

  let data = await metadata.fetchMetadata('wikipedia', html, 'http://skylerhamilton.info')
  console.log(`data: ${JSON.stringify(data, ' ', 2)}`)
}
//do_227()
async function do_227() {
  let html = Buffer.from(
    fs.readFileSync('./temp/227_imdb.html')
  ).toString('utf8')

  let data = await metadata.fetchMetadata('imdb', html, 'http://skylerhamilton.info')
  console.log(`data: ${JSON.stringify(data, ' ', 2)}`)

  html = Buffer.from(
    fs.readFileSync('./temp/227_wiki.html')
  ).toString('utf8')
  data = await metadata.fetchMetadata('wikipedia', html, 'http://skylerhamilton.info')
  console.log(`data: ${JSON.stringify(data, ' ', 2)}`)
}

//doWCCsvThing()
async function doWCCsvThing() {
  const thing = fs.readFileSync('/home/watashino/Downloads/wc.csv', {encoding:'utf8'})
  csv.parse(thing, {
    columns: true
  }, function(err, output){
    if (err) throw err
    fs.writeFileSync('wc.json', JSON.stringify(output, ' ', 2), {encoding:'utf8'})
  })
}

//hackImage()
// SHIT, havent verified this yet in action
async function hackImage() {
  const imgUrl = 'https://m.media-amazon.com/images/M/MV5BOTIzYmUyMmEtMWQzNC00YzExLTk3MzYtZTUzYjMyMmRiYzIwXkEyXkFqcGdeQXVyMDM2NDM2MQ@@._V1_QL75_UY281_CR2,0,190,281_.jpg'
  const urlObj = path.parse(imgUrl)
  if (urlObj.name.includes('._V1_')) {
    const newUrl = path.join(urlObj.dir, `${urlObj.name.split('._V1_')[0]}._V1_${urlObj.ext}`)
    console.log(newUrl)
  }
  console.log(urlObj)
}

//imdbSeries()
async function imdbSeries() {
  //const html = Buffer.from(fs.readFileSync('./temp/mip.html')).toString('utf8')
  const html = Buffer.from(fs.readFileSync('./temp/kit_carson_imdb.html')).toString('utf8')
  const data = await metadata.fetchMetadata('imdb', html, 'http://skylerhamilton.info')
  console.log(`data: ${JSON.stringify(data, ' ', 2)}`)
}

//imdbMovie()
async function imdbMovie() {
  console.log(metadata.sources)

  const html = Buffer.from(
    fs.readFileSync('./temp/h&b.html')
  ).toString('utf8')

  console.log(html.length)
  const data = await metadata.fetchMetadata('imdb', html, 'http://skylerhamilton.info')
  console.log(`data: ${JSON.stringify(data, ' ', 2)}`)
}

//altScanDir()
async function altScanDir() {
  const klaw = require('klaw')
  const through2 = require('through2')

  const excludeFilter = through2.obj(function(item, enc, next) {
    let exclude = false;
    if (item.stats.isDirectory()) exclude = true
    else {
      const basename = path.basename(item.path)
      if (basename === 'info.json') exclude = true
      else if (basename.startsWith('cover') && basename.endsWith('.jpg')) exclude = true
    }
    if (!exclude) this.push(item)
    next()
  })
  const filterFunc = item => {
    const basename = path.basename(item)
    return basename === '.' || basename[0] !== '.'
  }
  const items = []
  const totalSize = 0
  klaw('/home/user/projects/manifest/test_files', {filter: filterFunc})
    .pipe(excludeFilter)
    .on('data', item => {
      totalSize += item.stats.size
      items.push(item)
    })
    .on('end', () => { console.log(items) })

  // first, attempt to organize paths efficiently. we want the paths organized
  // neatly in a nested object
  const paths = [
    '/home/user/projects/manifest/test_files',
    '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)',
    '/home/user/projects/manifest/test_files/Tenchi Muyo',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa',
    '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/info.json',
    '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/metadata',
    '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/placeholder.json',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Magical Project S',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Sasami Magical Girls Club',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/info.json',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/metadata',
    '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/metadata/cover.jpg',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Magical Project S/info.json',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Magical Project S/metadata',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Sasami Magical Girls Club/info.json',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Sasami Magical Girls Club/metadata',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/metadata/cover.jpg',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/metadata/cover_0.jpg',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/metadata/cover_1.jpg',
    '/home/user/projects/manifest/test_files/jitsu wa, watashi wa/metadata/cover_test.jpn',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Magical Project S/metadata/cover_0.jpg',
    '/home/user/projects/manifest/test_files/Tenchi Muyo/Sasami Magical Girls Club/metadata/cover.jpg'
  ]

}

//mal()
async function mal() {
  const pathToJson = './test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/info.json'
  const existingData = JSON.parse(
    Buffer.from(
      fs.readFileSync(pathToJson)
    ).toString('utf8')
  )
  const html = Buffer.from(
    fs.readFileSync('./temp/index.html')
  ).toString('utf8')
  // 'http://skylerhamilton.info/images/Untid.png'
  const data = await metadata.fetchMetadata('myanimelist', html, 'http://skylerhamilton.info')
  //console.log('data', data)
  await metadata.saveMetadata('myanimelist', data, pathToJson, existingData)
  console.log('complete')
}

processHtml()
async function processHtml() {
  const html = Buffer.from(
    fs.readFileSync('./temp/big_order.html')
  ).toString('utf8')
  // 'http://skylerhamilton.info/images/Untid.png'
  const data = await metadata.fetchMetadata('myanimelist', html, 'http://skylerhamilton.info')
  console.log(data)
}

//doTrimming()
function doTrimming() {
  console.log(trim('People fall in love in the most mysterious of ways. This statement seems to be especially true for the affluent genius playboy Ryou',111,true))
  function trim(string, maxLength, addThingyToEnd) {
    if (!string || !string.length) return string
    if (string.length < maxLength) return string
    else {
      if (addThingyToEnd) return `${string.substring(0, maxLength-4)}...`
      else return string.substring(0, maxLength)
    }
  }
}

//playWithHtml()
async function playWithHtml() {
  const html = Buffer.from(
    fs.readFileSync('/home/user/projects/manifest/temp/jitsu_wa.html')
  ).toString('utf8')
  const $ = cheerio.load(html)

  const title = $('.title-name strong').text()
  const titleEnglish = $('.title-english').text()
  const description = $('p[itemprop=description]').text()
  const imageUrl = $('#content img').attr('data-src')

  $('.dark_text').each((i, el) => {
    const label = $(el).text()

    switch(label) {
      case 'Type:': {
        console.log('type', getValue({type:'nextElement',el,label}))
      } break;
      case 'Episodes:': {
        console.log('episodes', getValue({type:'innerText',el,label}))
      } break;
      case 'Status:': {
        console.log('status', getValue({type:'innerText',el,label}))
      } break;
      case 'Aired:': {
        console.log('aired', getValue({type:'innerText',el,label}))
      } break;
      case 'Premiered:': {
        console.log('premeried', getValue({type:'nextElement',el,label}))
      } break;
      case 'Producers:': {
        console.log('producers', getValue({type:'array',elementType:'a',el,label}))
      } break;
      case 'Licensors:': {
        console.log('licensors', getValue({type:'array',elementType:'a',el,label}))
      } break;
      case 'Studios:': {
        console.log('studios', getValue({type:'array',elementType:'a',el,label}))
      } break;
      case 'Source:': {
        console.log('source', getValue({type:'innerText',el,label}))
      } break;
      case 'Genres:': {
        console.log('genres', getValue({type:'array',elementType:'a',el,label}))
      } break;
      case 'Duration:': {
        console.log('duration', getValue({type:'innerText',el,label}))
      } break;
      case 'Rating:': {
        console.log('rating', getValue({type:'innerText',el,label}))
      } break;
      case 'Synonyms:': {
        console.log('synonyms', getValue({type:'innerText',el,label}))
      } break;
      case 'Japanese:': {
        console.log('japanese', getValue({type:'innerText',el,label}))
      } break;
      case 'English:': {
        console.log('english', getValue({type:'innerText',el,label}))
      } break;
    }
  })
  function getValue(params) {
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
}

//isImageValid()
async function isImageValid() {
  try {
    console.log('here')
    const size = await util.getImageSize('./test_files/cover.jpg')
    console.log('size', size)
  } catch(err) {
    console.log(err.code)
    console.log(err)
  }
}

//generateDoc1()
function generateDoc1() {
  const doc = new PDFDocument({margin:10});
  doc.pipe(fs.createWriteStream('doc1.pdf'));
  const table0 = {
      headers: ['Cover', 'Titles 1,2', 'Year, Ep ct, dur', 'rating, genre', 'description'],
      rows: [
          [
            {
              type: 'image',
              path: '/home/user/projects/manifest/test_files/Koi to Yobu ni wa Kimochi Warui (Season 1)/metadata/cover.jpg',
            },
            {
              type: 'link',
              text: 'Koi to Yobu wa Kimochi Warui\nKoikimo',
              url: 'https://myanimelist.net/anime/41103/Koi_to_Yobu_ni_wa_Kimochi_Warui',
            },
            'YR: 2021\nEPS: 12\n23 min per ep\nTYPE: TV',
            'RATING:PG-13\nComedy,Romance',
            // 111 chars max at this font and font size
            'People fall in love in the most mysterious of ways. This statement seems to be especially true for the affl...'
          ]
      ]
  };
  doc.table(table0, {
      prepareHeader: () => doc.font('Helvetica-Bold'),
      prepareRow: (row, i) => doc.font('Helvetica').fontSize(12)
  });
  doc.end()
}
//generateDoc0()
function generateDoc0() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('doc0.pdf'));

  const table0 = {
      headers: ['Word', 'Comment', 'Summary'],
      rows: [
          ['Apple', 'Not this one', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla viverra at ligula gravida ultrices. Fusce vitae pulvinar magna.'],
          ['Tire', 'Smells like funny', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla viverra at ligula gravida ultrices. Fusce vitae pulvinar magna.']
      ]
  };

  doc.table(table0, {
      prepareHeader: () => doc.font('Helvetica-Bold'),
      prepareRow: (row, i) => doc.font('Helvetica').fontSize(12)
  });

  const table1 = {
      headers: ['Country', 'Conversion rate', 'Trend'],
      rows: [
          ['Switzerland', '12%', '+1.12%'],
          ['France', '67%', '-0.98%'],
          ['England', '33%', '+4.44%']
      ]
  };

  doc.moveDown().table(table1, 100, 350, { width: 300 });

  doc.end();
}
