// @flow
import test from '../lib/tape'
import main from './main'

export const name: string = process.env.npm_package_name || 'WRTE'
export const version: string = process.env.npm_package_version || '?'
export const build: string = process.env.git_build_sha || '?'

const VERSION = `${name} ${version} (${build})`
global.console.log(`${VERSION} booting...`)
document.title = VERSION
window.onload = main

if (process.env.NODE_ENV === 'ci') {
  test.onFinish(() => {
    window.close()
  })
}
