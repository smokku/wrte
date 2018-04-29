let init = null
const channels = {}
const queue = []

const CONSOLE = 'con:'
const WINDOW = 'win:'

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

function logPayload (payload) {
  global.postMessage({
    channel: channels[CONSOLE],
    type: 'DATA',
    payload,
    severity: 'NORMAL',
  })
}
