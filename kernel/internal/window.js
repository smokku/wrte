// @flow strict
import type { Message } from '../ipc'
import type { Process, Channel } from '../proc'

import Window from '../window'
import { errorReply } from '../ipc'

let root

export function init () {
  root = document.body
  global.console.log('[window:]', 'Obtained BODY reference')
}

export function handler (to: Pid | Channel, from: Process, msg: Message) {
  global.console.log('[window:]', msg.type, this.argv, to, from.pid, msg)
  if (typeof to === 'object') {
    const channel: Channel = to
    const { type, payload } = msg || {}
    const { position } = typeof payload === 'object' ? payload : {}
    let win
    switch (type) {
      case 'OPEN':
        if (!channel.meta) {
          win = new Window()
          channel.meta = {
            window: win,
            pid: from.pid,
          }
          win.on('key', (key) => {
            if (typeof channel.handler === 'function') {
              channel.send({
                type: 'KEY',
                payload: {
                  type: 'PRESS',
                  key,
                },
              })
            }
          })
        } else {
          win = channel.meta.window
        }
        if (position) win.setPosition(position)
        win.show(root)
        break
      case 'CLOSE':
        if (channel.meta) {
          win = channel.meta.window
        }
        break
      default:
        global.console.warn(`[window:] unhandled message: ${JSON.stringify(msg)}`)
    }
  } else {
    from.postMessage(errorReply('ENOENT', msg))
  }
}
