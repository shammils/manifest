const fs = require('fs-extra')
const path = require('path')

;(async () => {
  const count = parseInt(process.env.COUNT)
  let dumpDir
  const baseJson = await fs.readJson(process.env.BASEJSONPATH)
  if (process.env.DUMPPATH) {
    await fs.ensureDir(process.env.DUMPPATH)
    dumpDir = process.env.DUMPPATH
  }
  if (!isNaN(count) && dumpDir) {
    for (let i = 0; i < count; i++) {
      const productPath = path.join(dumpDir, `__zzNAME-TYPE-YEAR${i}`)
      await fs.ensureDir(productPath)
      await fs.writeJson(path.join(productPath, 'info.json'), baseJson, {spaces:2})
    }
    console.log('done')
  } else {
    console.log('params broke')
  }
})()
