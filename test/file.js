// @flow
/* eslint-disable unicorn/prefer-add-event-listener */
import File from '../lib/file'

/**
 * This test works like this:
 * 1. Create File() interface
 * 2. Read TEST_FILE
 * 3. CLOSE File interface.
 */

let init = null

global.console.log('[test/file] starting')

global.onmessage = async (evt) => {
  const { data } = evt
  if (data === 'PING') {
    global.postMessage('PONG')
    return
  }
  const { type, payload } = data
  global.console.log(`[test/file ${init ? init.pid : '?'}]`, data)
  if (type === 'INIT' && !init) {
    init = payload
    const { path } = init
    global.console.log(`[test/file] started; reading: ${path}`)
    const file = await File(path)
    const content = await file.read()
    if (content && content.length > 0) {
      global.console.info('[test/file] 👌 TEST SUCCESS')
    } else {
      global.console.error('[test/file] 😞 TEST FAILURE!')
    }
    global.postMessage('TERMINATE')
  } else if (type === 'ERROR') {
    global.console.warn(`[test/file] ERROR: ${JSON.stringify(payload)}`)
  }
}
