let init = null
const channels = {}

let dest

global.console.log('[test/channel] starting')

global.onmessage = (evt) => {
  const { data } = evt
  if (data === 'PING') {
    global.postMessage('PONG')
    return
  }
  const { type, payload } = data
  // console.log(`[test/channel ${init ? init.pid : '?'}]`, data)
  if (type === 'INIT' && !init) {
    ({
      argv: [dest],
    } = init = payload) //  eslint-disable-line no-multi-assign
    global.console.log(`[test/channel] started ${dest}`)
    if (dest) {
      global.postMessage({
        type: 'OPEN',
        process: dest,
      })
    }
  } else if (type === 'CHANNEL' && data.process) {
    channels[data.process] = data.channel
    if (dest) {
      global.postMessage({
        type: 'DATA',
        channel: channels[dest],
        payload: 'PING',
      })
    }
  } else if (type === 'DATA' && data.channel) {
    global.console.log(`[test/channel ${init ? init.pid : '?'}] DATA: ${JSON.stringify(payload)}`)
    let reply
    switch (payload) {
      case 'PING':
        reply = 'PONG'
        break
      case 'PONG':
        reply = 'PING2'
        break
      case 'PING2':
        reply = 'PONG2'
        break
      case 'PONG2':
        console.log('[test/channel] TEST SUCCESS')
        global.postMessage('TERMINATE')
        return
      default:
        console.error('[test/channel] TEST FAILED!')
        global.close()
        return
    }
    global.postMessage({
      type: 'DATA',
      channel: data.channel,
      payload: reply,
    })
  } else if (type === 'ERROR') {
    global.console.warn(`[test/channel] ERROR: ${JSON.stringify(payload)}`)
  } else {
    global.console.warn(`[test/channel] UNHANDLED: ${JSON.stringify(payload)}`)
  }
}
