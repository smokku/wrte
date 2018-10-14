// @flow
import EventEmitter from './event-emitter'

import type { ArgV, Pid } from '../kernel/proc'
import type { MessageType } from '../kernel/ipc'

/**
 * Add _Channel_ to _Process_.
 * @param id - _Channel_ id.
 */
function addChannel (id) {
  const channel = new EventEmitter()
  this.channels.set(id, channel)
  this.emit('channel-open', channel)
}

/**
 * _Process_ interface for worker thread.
 *
 * This is an _EventEmitter_ which emits the following events:
 * - 'init' - when the _Process_ gets INIT information from kernel.
 * - 'channel-open' - when new _Channel_ is opened.
 * - 'channel-close' - when _Channel_ is closed.
 * - 'message' - when direct _Message_ is received.
 */
class Process extends EventEmitter {
  name: string

  pid: string

  path: string

  argv: ArgV

  /**
   * Map of opened _Channel_s.
   *
   * This is an _EventEmitter_ which emits the following events:
   * - 'message' - when the _Channel_ gets new _Message_.
   * - 'close' - when _Channel_ is closed.
   */
  channels: Map<string, EventEmitter>

  constructor (name) {
    if (!name) {
      throw new Error('Process name needs to be defined')
    }

    super()
    this.name = name
    this.channels = new Map()

    global.console.log(`[${this.name}] starting`)

    this.messageHandler = this.messageHandler.bind(this)
    global.addEventListener('message', this.messageHandler)
  }

  messageHandler: MessageEvent => void

  messageHandler (evt) {
    const { data } = evt
    if (data === 'PING') {
      global.postMessage('PONG')
      return
    }
    // console.debug(`[${this.name}]`, data)

    if (data.type === 'INIT' && !this.pid) {
      const init = data.payload
      this.path = init.path
      this.pid = init.pid
      this.argv = init.argv
      init.channels.forEach((id) => {
        addChannel.call(this, id)
      })
      global.console.log(`[${this.name}] started ${JSON.stringify(this.argv)}`)
      this.emit('init', this)
    } else if (data.type === 'CHANNEL' && data.path) {
      this.channels[data.path] = data.channel
    } else if (data.type === 'ERROR') {
      global.console.warn(`[${this.name}] ERROR: ${JSON.stringify(data.payload)}`)
    } else {
      global.console.warn(`[${this.name}] Unhandled message: ${JSON.stringify(data)}`)
    }
  }

  /**
   * Send message to _Process_.
   *
   * @param pid - _Process_ ID.
   * @param type - _Message_ type.
   * @param payload - _Message_ payload.
   */
  // eslint-disable-next-line class-methods-use-this
  postMessage (pid: Pid, type: MessageType, payload: {}) {
    global.postMessage({ pid, type, payload })
  }
}

export default (name: string): Promise<Process> => new Promise((resolve, reject) => {
  const process = new Process(name)
  // eslint-disable-next-line require-jsdoc
  function resolveProcess () {
    process.off('init', resolveProcess)
    resolve(process)
  }
  process.on('init', resolveProcess)
})
