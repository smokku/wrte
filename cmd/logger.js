let init = null
const channels = {}

const CONSOLE = 'con:'
const WEBDAV = 'internal:webdav'

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
      path: WEBDAV,
    })
  } else if (data.type === 'CHANNEL' && data.path) {
    channels[data.path] = data.channel
    if (data.path === WEBDAV) {
      global.postMessage({
        type: 'READ',
        channel: channels[WEBDAV],
      })
    }
  } else if (data.type === 'ERROR') {
    global.console.warn(`[logger] ERROR: ${JSON.stringify(data.payload)}`)
  } else {
    const msg = JSON.stringify(data)
    global.console.log(`[logger] ${msg}`)
    if (channels[CONSOLE]) {
      global.postMessage({
        channel: channels[CONSOLE],
        type: 'DATA',
        payload: msg,
        severity: 'NORMAL',
      })
    } else {
      console.warn(`[logger] no ${CONSOLE} channel`)
    }
  }
}
