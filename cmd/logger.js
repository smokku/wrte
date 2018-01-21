let init = null
const channels = {}

const CONSOLE = 'con:'
const WINDOW = 'win:'

global.console.debug('[logger] starting')

global.onmessage = (evt) => {
  const { data } = evt
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
  } else if (data.type === 'ERROR') {
    global.console.warn(`[logger] ERROR: ${JSON.stringify(data.payload)}`)
  } else {
    global.console.log(`[logger] ${JSON.stringify(data.payload)}`)
    const payload = JSON.stringify(data.payload)
    if (channels[CONSOLE]) {
      global.postMessage({
        channel: channels[CONSOLE],
        type: 'DATA',
        payload,
        severity: 'NORMAL',
      })
    } else {
      console.warn(`[logger] no ${CONSOLE} channel`)
    }
  }
}
