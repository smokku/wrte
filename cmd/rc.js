/*
 * http://man.cat-v.org/plan_9/1/rc
 */
// @flow

import init from '../lib/process'

const version: string = process.env.npm_package_version || '0.?'
const build: string = process.env.git_build_sha || '???'
const VERSION = `rc ${version} (${build})`;

(async function main () {
  // $FlowFixMe: still buggy support for async/await ?
  const proc = await init('rc')
  console.debug(proc)

  // FIXME: remove manual opening of window
  // Designed way is to do it using VFS internal:window handler, like so:
  // > open win:100x200 | rc
  global.postMessage({
    type: 'OPEN',
    path: 'win:',
    payload: {
      position: { // FIXME: load/save in config file
        x: 300,
        y: 16,
        width: 300,
        height: 150,
      },
    },
  })

  proc.on('channel-open', (channel) => {
    // set window body style, FIXME: load from config style
    channel.write({
      style: 'body {background-color: rgba(133,133,133,.9); color: white}',
    })
    // set prompt > content
    channel.write(`${VERSION}\n> `)
  })
})()
