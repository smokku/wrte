// @flow
import type { Message, Channel } from '../ipc'
import type { Process } from '../proc'
import type { Rect } from '../window'

import Window from '../window'
import { errorReply } from '../ipc'

let root

/**
 * `internal:` window init()ialization function.
 */
export function init () {
  root = document.body
  window.console.log('[window:]', 'Obtained BODY reference')
}

/**
 * `internal:` window handler function.
 *
 * @param to - _Channel_ the _Message_ was sent to.
 * @param from - _Process_ sending the _Message_.
 * @param msg - _Message_ to be handled.
 */
export function handler (to: Channel, from: Process, msg: Message): void {
  window.console.debug('[window:]', msg.type, this.argv, to, from.pid, msg)
  if (typeof to === 'object') {
    const channel: Channel = to
    const { type, payload } = msg || {}

    let position: ?Rect
    if (typeof payload === 'object' && !(payload instanceof ArrayBuffer)) {
      if (
        payload.position &&
        typeof payload.position === 'object' &&
        typeof payload.position.x === 'number' &&
        typeof payload.position.y === 'number' &&
        typeof payload.position.height === 'number' &&
        typeof payload.position.width === 'number'
      ) {
        ({ position } = payload)
      }
    }

    let win
    switch (type) {
      case 'OPEN':
        if (!channel.meta) {
          win = new Window()
          channel.meta = {
            window: win,
          }
          win.on('key', (key) => {
            if (typeof channel.send === 'function') {
              channel.send({
                type: 'EVENT',
                payload: {
                  type: 'PRESS',
                  key,
                },
              })
            }
          })
        } else if (typeof channel.meta === 'object') {
          win = channel.meta.window
        }
        if (win instanceof Window) {
          if (position) win.setPosition(position)
          win.show(root)
        }
        break
      case 'CLOSE':
        if (channel.meta) {
          win = channel.meta.window
        }
        if (win instanceof Window) {
          win.close()
        }
        break
      default:
        window.console.warn(`[window:] unhandled message: ${JSON.stringify(msg)}`)
    }
  } else {
    from.postMessage(errorReply('ENOENT', msg))
  }
}
