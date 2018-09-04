// @flow
import test from '../test/tape'
import main from './main'

export const name: string = process.env.npm_package_name || 'WRTE'
export const version: string = process.env.npm_package_version || '0.?'
export const build: string = process.env.git_build_sha || '???'

const VERSION = `${name} ${version} (${build})`
window.console.log(`${VERSION} booting...`)
document.title = VERSION
window.addEventListener('load', main)

test.onFinish(() => {
  window.console.log('All tests finished')
  // eslint-disable-next-line no-underscore-dangle
  window.__tests_done__ = true
})
