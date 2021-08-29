/*
  Basically only here to remind to actually build this thing. we want manifest
  of all relevant files in dir(s) in a clean html interface. where the butts did
  the klaw code go? my guess is in scratchpad on work machine. need to check
  scratchpad into dump project, tired of it getting wildly out of sync.
*/
const nodeUtil = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const klaw = require('klaw')
const path = require('path')

let _self

function log(level, message) { _self.emit("log",{module:'scanDir',level,message})}

class ScanDir {
  constructor() {
    _self = this
    EventEmitter.call(this)
  }
  async handler(event) {

  }
}

nodeUtil.inherits(ScanDir, EventEmitter)

module.exports = ScanDir
