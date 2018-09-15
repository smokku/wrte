// @flow
import test from '../test/tape'
import main from './main'
import { spawn, ps } from './proc'

export const name: string = process.env.npm_package_name || 'WRTE'
export const version: string = process.env.npm_package_version || '0.?'
export const build: string = process.env.git_build_sha || '???'

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

    window.console.log('All tests finished')
  })
}
