// @flow strict
/* eslint-disable unicorn/prefer-add-event-listener */

/**
 * This test works like this:
 * 1. OPEN window
 * 2. When window channel is opened -> CLOSE window
 * 3. window channel close -> TEST SUCCESS (TERMINATE)
 */

let init = null
const channels = {}

const WINDOW = 'win:'

global.console.log('[test/window] starting')

global.onmessage = (evt) => {
  const { data } = evt
  if (data === 'PING') {
    global.postMessage('PONG')
    return
  }
  const { type, payload } = data
  global.console.log(`[test/window ${init ? init.pid : '?'}]`, data)
  if (type === 'INIT' && !init) {
    init = payload
    global.console.log(`[test/window] started`)
    global.postMessage({
      type: 'OPEN',
      path: WINDOW,
      payload: {
        position: {
          x: 20,
          y: 10,
          width: 200,
          height: 100,
        },
      },
    })
  } else if (type === 'CHANNEL' && typeof data.channel === 'string') {
    if (data.path) {
      channels[data.channel] = data.path
      if (data.path === WINDOW) {
        setTimeout(() => {
          global.postMessage({
            type: 'CLOSE',
            channel: data.channel,
          })
        }, 100)
      }
    } else {
      const channel = channels[data.channel]
      if (channel) {
        global.console.info('[test/window] 👌 TEST SUCCESS')
        global.postMessage('TERMINATE')
      }
      delete channels[data.channel]
    }
  } else if (type === 'ERROR') {
    global.console.warn(`[test/window] ERROR: ${JSON.stringify(payload)}`)
  } else {
    global.console.warn(`[test/window] UNHANDLED: ${JSON.stringify(payload)}`)
  }
}
