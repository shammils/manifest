const Metadata = require('./lib/metadata.js')
const metadata = new Metadata()
const Manifest = require('./lib/manifest.js')
const manifest = new Manifest()
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
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

(async () => {
  if (!argv.data) throw `--data arg required`
  else {
    try {
      JSON.parse(argv.data)
    } catch(err) {
      throw `--data parameter not valid json`
    }
  }
  switch(argv.method) {
    case 'metadata':
      await metadata.handler(JSON.parse(argv.data))
      break
    case 'manifest':
      await manifest.handler(JSON.parse(argv.data))
      break
    default:
      throw `method '${argv.method}' unsupported or invalid`
  }
  return
})()
