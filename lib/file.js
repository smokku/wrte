// @flow
import EventEmitter from './event-emitter'

import type { Message } from '../kernel/ipc'

/**
 * _File_ interface for VFS path.
 *
 * This is an _EventEmitter_ which emits the following events:
 * - 'channel-open' - when vfs _Channel_ is opened.
 * - 'channel-close' - when _Channel_ is closed.
 * - 'message' - when _Channel_ gets a message.
 */
class File extends EventEmitter {
  path: string

  channel: string

  constructor (path, payload?: {}) {
    if (!path) {
      throw new Error('File path needs to be defined')
    }

    super()
    this.path = path

    this.messageHandler = this.messageHandler.bind(this)
    global.addEventListener('message', this.messageHandler)

    global.console.debug(`Opening ${path} channel`)
    const message: Message = {
      type: 'OPEN',
      path,
    }
    if (payload) message.payload = payload
    global.postMessage(message)
  }

  messageHandler: MessageEvent => void

  messageHandler (evt) {
    const { data } = evt
    if (data.path === this.path) {
      if (data.type === 'CHANNEL' && typeof data.channel === 'string') {
        this.channel = data.channel
        this.emit('channel-open', this.channel)
      } else {
        global.console.warn(`[${this.path}] Unhandled message: ${JSON.stringify(data)}`)
      }
    }
  }

  /**
   * Close the file.
   * @returns Promise of closed file.
   */
  // eslint-disable-next-line class-methods-use-this
  close () {
    return new Promise((resolve, reject) => {
      reject(new Error('not implemented'))
    })
  }

  /**
   * Read contents of the file.
   * @param count - Number of octets to read. Reads whole file if not given.
   * @returns Promise of file contents.
   */
  read (count?: number) {
    return new Promise((resolve, reject) => {
      if (!this.channel) {
        reject(new Error(`File ${this.path} has no OPEN channel`))
        return
      }

      global.postMessage({
        type: 'READ',
        channel: this.channel,
      })
    })
  }
}

export default (path: string, payload?: {}): Promise<File> => new Promise((resolve, reject) => {
  const file = new File(path, payload)
  // eslint-disable-next-line require-jsdoc
  function resolveFile () {
    file.off('channel-open', resolveFile)
    resolve(file)
  }
  file.on('channel-open', resolveFile)
})
