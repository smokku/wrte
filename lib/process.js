// @flow
import EventEmitter from './event-emitter'

import type { ArgV, Pid } from '../kernel/proc'
import type { MessageType } from '../kernel/ipc'

type ChannelMeta = {
  path?: string,
  pid?: string,
}

/**
 * _Channel_ information class.
 *
 * @class Channel
 */
class Channel extends EventEmitter {
  id: string

  path: string

  pid: string

  constructor (id: string, meta: ChannelMeta = {}) {
    super()
    this.id = id
    if (meta.path) this.path = meta.path
    if (meta.pid) this.pid = meta.pid
  }

  write (data) {
    global.postMessage({
      type: 'DATA',
      channel: this.id,
      payload: data,
    })
  }
}

// NOTE: Following "methods" are "private" - these are not part of _Process_ class API surface.

/**
 * Add _Channel_ to _Process_.
 * @param id - _Channel_ id.
 * @param meta - _Channel_ metadata.
 */
function addChannel (id: string, meta: ChannelMeta) {
  const channel = new Channel(id, meta)
  this.channels.set(id, channel)
  this.emit('channel-open', channel)
}

/**
 * Removes _Channel_ from _Process_.
 * @param id - _Channel_ id.
 */
function removeChannel (id: string) {
  const channel = this.channels.get(id)
  if (channel) {
    this.channels.delete(id)
    this.emit('channel-close', channel)
  }
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
  channels: Map<string, Channel>

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
        addChannel.call(this, id, {})
      })
      global.console.log(`[${this.name}] started ${JSON.stringify(this.argv)}`)
      this.emit('init', this)
    } else if (data.type === 'CHANNEL') {
      if (data.path || data.pid) {
        addChannel.call(this, data.channel, { path: data.path, pid: data.pid })
      } else {
        removeChannel.call(this, data.channel)
      }
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
