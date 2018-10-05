// @flow
/* eslint-disable func-names, no-cond-assign, prefer-rest-params */
import test from '../test/tape'
import main from './main'
import { spawn, ps } from './proc'

export const name: string = process.env.npm_package_name || 'WRTE'
export const version: string = process.env.npm_package_version || '0.?'
export const build: string = process.env.git_build_sha || '???'

/* Intercept console.log() to internal:console */
let internalQueue = []
let internalLog
window.console = new Proxy(window.console, {
  get (target, prop, receiver) {
    if (prop === 'log') {
      return (
        internalLog ||
        function () {
          return internalQueue && internalQueue.push(arguments)
        }
      )
    }
    if (prop === 'group' && internalLog) {
      return internalLog.bind(null, '--- ')
    }
    if (prop === 'groupEnd' && internalLog) {
      return internalLog.bind(null, '--- ')
    }
    return Reflect.get(...arguments)
  },
})
window.consoleTap = function (log) {
  delete window.consoleTap
  let msg
  if (internalQueue) {
    while ((msg = internalQueue.shift())) {
      log(...msg)
    }
  }
  internalLog = log
  internalQueue = undefined
}

/* Proceed with Kernel main() */
const VERSION = `${name} ${version} (${build})`
window.console.log(`${VERSION} booting...`)
document.title = VERSION
window.onload = main

if (process.env.NODE_ENV === 'test') {
  test.onFinish(() => {
    /* expose interface for functional tests */
    window.kernel = {
      spawn,
      ps,
    }

    window.console.info('All tests finished')
  })
}
