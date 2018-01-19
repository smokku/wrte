let init = null
let con = null // con: channel

global.console.debug('[logger] starting')

global.onmessage = (evt) => {
  const { data } = evt
  if (data.type === 'INIT' && !init) {
    init = data.payload
    global.console.log(`[logger] started ${JSON.stringify(init.argv)}`)
  } else if (data.type === 'CHANNEL' && data.id === 'con') {
    con = data.payload
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
    }
  }
}

global.postMessage({
  type: 'OPEN',
  path: 'con:',
})
