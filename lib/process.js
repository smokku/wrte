// @flow
import EventEmitter from './event-emitter'

import type { ArgV } from '../kernel/proc'

/**
 * Process interface for worker thread.
 */
class Process extends EventEmitter {
  name: string

  pid: string

  path: string

  argv: ArgV

  channels: {
    [string]: Object,
  }

  constructor (name) {
    if (!name) {
      throw new Error('Process name needs to be defined')
    }

    super()
    this.name = name
    this.channels = {}

    global.console.log(`[${this.name}] starting`)

    global.onmessage = (evt) => {
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
        if (init.channels) {
          // TODO: put channels to this.channels
        }
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
