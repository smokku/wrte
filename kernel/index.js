import test from '../lib/tape'
import main from './main'

export const name = process.env.npm_package_name
export const version = process.env.npm_package_version
export const build = process.env.git_build_sha

global.console.log(`${name} ${version} (${build}) booting...`)
window.onload = main

if (process.env.NODE_ENV === 'ci') {
  test.onFinish(() => {
    window.close()
  })
}
