// @flow strict
import test from '../lib/tape'
import main from './main'

export const name: string = process.env.npm_package_name || 'WRTE'
export const version: string = process.env.npm_package_version || '0.?'
export const build: string = process.env.git_build_sha || '???'

const VERSION = `${name} ${version} (${build})`
global.console.log(`${VERSION} booting...`)
document.title = VERSION
window.addEventListener('load', main)

if (process.env.NODE_ENV === 'test') {
  test.onFinish(() => {
    // eslint-disable-next-line no-underscore-dangle
    Object.values(window.__coverage__).forEach((cov) => {
      if (cov && typeof cov === 'object' && typeof cov.path === 'string') {
        // eslint-disable-next-line no-console
        console.log(':cov', cov.hash, JSON.stringify({ [cov.path]: cov }))
      }
    })
    window.close()
  })
}
