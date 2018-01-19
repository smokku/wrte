let init = null
let con = null // con: channel

global.console.debug('[logger] starting')

global.onmessage = (evt) => {
  const { data } = evt
  // console.debug('[logger]', data)
  if (data.type === 'INIT' && !init) {
    init = data.payload
    global.console.log(`[logger] started ${JSON.stringify(init.argv)}`)
  } else if (data.type === 'CHANNEL' && data.path === 'con:') {
    con = data.channel
  } else if (data.type === 'ERROR') {
    global.console.warn(`[logger] ERROR: ${JSON.stringify(data.payload)}`)
  } else {
    const msg = JSON.stringify(data)
    global.console.log(`[logger] ${msg}`)
    if (con) {
      global.postMessage({
        channel: con,
        type: 'DATA',
        payload: msg,
        severity: 'NORMAL',
      })
    } else {
      console.warn('[logger] no con: channel')
    }
  }
}

global.postMessage({
  type: 'OPEN',
  path: 'con:',
})
