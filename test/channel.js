// @flow
/* eslint-disable unicorn/prefer-add-event-listener */

/**
 * This test works like this:
 * 1. Spawn two processes, pointing P2 to P1 pid using arg
 * 2. Open channel to P1 from P2
 * 3. Send a sequence of messages: PING, PONG, PING2, PONG2
 * 4. PONG2 causes TERMINATE in process P2
 * 5. TERMINATE process causes CLOSE channel in P1 -> TEST SUCCESS
 */

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
    } = init = (payload: any)) //  eslint-disable-line no-multi-assign
    global.console.log(`[test/channel] started ${dest}`)
    if (dest) {
      global.postMessage({
        type: 'OPEN',
        process: dest,
      })
    }
    setTimeout(() => {
      global.console.error('[test/channel] 😞 TEST FAILURE!')
      global.close()
    }, 1000)
  } else if (type === 'CHANNEL' && typeof data.channel === 'string') {
    if (data.process) {
      channels[data.channel] = data.process
      if (dest && data.process === dest) {
        global.postMessage({
          type: 'DATA',
          channel: data.channel,
          payload: 'PING',
        })
      }
    } else {
      const channel = channels[data.channel]
      if (channel) {
        if (!dest) {
          global.console.info('[test/channel] 👌 TEST SUCCESS')
        }
        global.postMessage('TERMINATE')
      }
      delete channels[data.channel]
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
        global.postMessage('TERMINATE')
        return
      default:
        global.console.error('[test/channel] 😞 TEST FAILURE!')
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
