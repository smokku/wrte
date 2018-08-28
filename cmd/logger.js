// @flow strict
/* eslint-disable unicorn/prefer-add-event-listener */
let init = null
const channels = {}
const queue = []

const CONSOLE = 'con:'

global.console.log('[logger] starting')

global.onmessage = (evt) => {
  const { data } = evt
  if (data === 'PING') {
    global.postMessage('PONG')
    return
  }
  // console.debug('[logger]', data)
  if (data.type === 'INIT' && !init) {
    init = data.payload
    global.console.log(`[logger] started ${JSON.stringify(init.argv)}`)

    global.postMessage({
      type: 'OPEN',
      path: CONSOLE,
    })
  } else if (data.type === 'CHANNEL' && data.path) {
    channels[data.path] = data.channel
    queue.forEach((payload) => {
      logPayload(payload)
    })
    queue.length = 0
  } else if (data.type === 'ERROR') {
    global.console.warn(`[logger] ERROR: ${JSON.stringify(data.payload)}`)
  } else if (data.payload) {
    global.console.log(`[logger] ${JSON.stringify(data.payload)}`)
    const payload = JSON.stringify(data.payload)
    if (channels[CONSOLE]) {
      logPayload(payload)
    } else {
      queue.push(payload)
    }
  } else {
    global.console.warn(`[logger] Unhandled message: ${JSON.stringify(data)}`)
  }
}

/**
 * Helper function to log argument as payload to console.
 *
 * @param payload - Stuff to log.
 */
function logPayload (payload: {} | string) {
  global.postMessage({
    channel: channels[CONSOLE],
    type: 'DATA',
    payload,
  })
}
