import Window from '../window'
import { handleMessage } from '../vfs'

let root

export function init () {
  root = document.body
  global.console.log('[window:]', 'Obtained BODY reference')
}

export function handler (path, from, msg, channel) {
  global.console.log('[window:]', msg.type, this.argv, path, from.pid, msg, channel)
  const { type, payload } = msg
  const { position } = typeof payload === 'object' ? payload : {}
  const { meta } = channel
  let win
  switch (type) {
    case 'OPEN':
      if (!meta) {
        win = new Window()
        // eslint-disable-next-line no-param-reassign
        channel.meta = {
          window: win,
          pid: from.pid,
        }
        win.on('key', (key) => {
          const data = {
            type: 'KEY',
            payload: {
              type: 'PRESS',
              key,
            },
          }
          handleMessage(channel.handler, path, from, data, channel)
        })
      } else {
        win = meta.window
      }
      if (position) win.setPosition(position)
      win.show(root)
      break
    default:
      global.console.warn(`[window:] unhandled message: ${JSON.stringify(msg)}`)
  }
}
