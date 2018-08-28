// @flow
import type { Message, Channel } from '../ipc'
import type { Process } from '../proc'

let root

/**
 * `internal:` console init()ialization function.
 */
export function init () {
  root = document.createElement('div')
  root.id = 'console'
  root.style.position = 'absolute'
  root.style.left = '0'
  root.style.right = '0'
  root.style.top = '0'
  root.style.bottom = '0'
  if (document.body) {
    document.body.appendChild(root)
    global.console.log('[console:]', 'Created root window')
  } else {
    throw new Error('Cannot attach console: root window')
  }
}

/**
 * `internal:` console handler function.
 *
 * @param to - _Channel_ the _Message_ was sent to.
 * @param from - _Process_ sending the _Message_.
 * @param msg - _Message_ to be handled.
 */
export function handler (to: Channel, from: Process, msg: Message): void {
  // global.console.log('[console:]', msg.type, this.argv, path, from.pid, msg)
  if (msg.type === 'DATA' && typeof msg.payload === 'string') {
    root.innerText = `${root.innerText || ''}${msg.payload}\n`
  }
}
