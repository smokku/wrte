// @flow
import test from '../lib/tape'
import EventEmitter from './event-emitter'
import Sandbox from './sandbox'
import id from '../lib/id'

const processes = Object.create(null)

export default function init () {
  global.console.log('Initializing PROC')

  window.addEventListener('message', (evt) => {
    // console.log('PROC', evt)
    if (evt.isTrusted && evt.origin === 'null' && typeof evt.data === 'string') {
      const proc = getProcessForWindow(evt.source)

      if (proc) {
        switch (evt.data) {
          case 'CREATED':
            proc.postMessage({
              type: 'INIT',
              payload: {
                pid: proc.pid,
                path: proc.path,
                argv: proc.argv,
                channels: Object.keys(proc.channels),
              },
            })
            proc.status = 'RUNNING'
            break
          case 'TERMINATE':
            proc.status = 'TERMINATING'
            proc.terminate()
            break
          default:
          // drop
        }
      }
    }
  })
}

const PROCESS_STATUS = Symbol('status')

export class Process extends EventEmitter {
  constructor (pid: string, path: string, argv: Array<any>) {
    super()
    this.pid = pid
    this.path = path
    this.argv = argv
    this.status = 'SPAWNING'
    this.sandbox = new Sandbox(pid, path)
    this.channels = Object.create(null)
  }

  get status (): string {
    return this[PROCESS_STATUS]
  }

  set status (status: string) {
    this[PROCESS_STATUS] = status
    this.emit('status', status)
  }

  terminate () {
    // FIXME: what about other ends of this.channels? we should CLOSE them
    this.sandbox.terminate()
    this.status = 'TERMINATED'
  }

  postMessage (msg: {}) {
    this.sandbox.postMessage(msg)
  }

  openChannel () {
    let chan = id()
    // create unique channel id
    while (Object.prototype.hasOwnProperty.call(this.channels, chan)) chan = id()
    return (this.channels[chan] = { id: chan })
  }

  getChannel (chan: string) {
    return this.channels[chan.toString()]
  }

  closeChannel (chan: string) {
    delete this.channels[chan.toString()]
  }
}

export function getProcess (pid: string) {
  return processes[pid]
}

export function getProcessForWindow (window: {}) {
  const pid = Object.keys(processes).find(p => processes[p].sandbox.window === window)
  return pid && getProcess(pid)
}

export function spawn (path: string, argv: Array<mixed> = []): string | null {
  if (!Array.isArray(argv)) {
    global.console.error(`Invalid argv '${typeof argv}' for ${path}`)
    return null
  }
  global.console.log(`Spawning "${path}" ${JSON.stringify(sanitizeArgv(argv))}`)

  let pid = id()
  while (Object.prototype.hasOwnProperty.call(processes, pid)) pid = id()

  processes[pid] = new Process(pid, path.toString(), [].concat(argv))
  processes[pid].on('status', (status) => {
    if (status === 'TERMINATED') {
      delete processes[pid]
      global.console.log(`Terminated "${path}" ${JSON.stringify(sanitizeArgv(argv))}`)
    }
  })
  return pid
}

export function sanitizeArgv (argv: Array<mixed>) {
  return argv.map((arg) => {
    switch (typeof arg) {
      case 'object':
        return arg ? `{${Object.keys(arg).join(',')}}` : arg
      case 'function':
        return `${arg.displayName || arg.name || ''}()`
      default:
        return arg
    }
  })
}

export function ps () {
  return Object.values(processes).map(({
    pid, path, argv, status,
  }) => ({
    pid,
    path,
    argv: sanitizeArgv(argv),
    status,
  }))
}

test('sanitizeArgv', (t) => {
  t.deepEqual(sanitizeArgv([1, 'two']), [1, 'two'])
  t.deepEqual(sanitizeArgv(['', undefined]), ['', undefined])
  t.deepEqual(sanitizeArgv([1, { foo: 'bar' }, { baz: 0 }]), [1, '{foo}', '{baz}'])
  t.deepEqual(sanitizeArgv([{}, undefined, null, {}]), ['{}', undefined, null, '{}'])
  t.deepEqual(sanitizeArgv([function saniTest () {}, null, () => () => 0, {}]), [
    'saniTest()',
    null,
    '()',
    '{}',
  ])
  t.end()
})
