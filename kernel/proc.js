// @flow
import test from '../lib/tape'

import type { Message, Channel } from './ipc'

import EventEmitter from './event-emitter'
import Sandbox from './sandbox'
import id from '../lib/id'

const processes: Map<Pid, Process> = new Map()

/**
 * PROC init()ialization.
 */
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

/// _Process_ ID
export type Pid = string
export type ProcessStatus = 'SPAWNING' | 'RUNNING' | 'TERMINATING' | 'TERMINATED'

export type Capability = 'spawn' | 'mount' | 'window:text' | 'window:canvas'

/**
 * Process class.
 * Wrapper for iframe+WebWorker untrusted code {Sandbox}. Used to spawn, control
 * and terminate underlying WebWorker process.
 *
 * @export
 * @class Process
 * @extends {EventEmitter}
 */
export class Process extends EventEmitter {
  pid: Pid

  path: string

  argv: Array<mixed>

  status: ProcessStatus

  sandbox: Sandbox

  channels: {| [string]: Channel |}

  capabilities: Array<Capability>

  constructor (pid: Pid, path: string, argv: Array<mixed>) {
    super()
    this.pid = pid
    this.path = path
    this.argv = argv
    this.status = 'SPAWNING'
    this.sandbox = new Sandbox(pid, path)
    this.channels = (Object.create(null): any)
  }

  get status (): string {
    // $FlowFixMe: Until flow supports computed properties
    return this[PROCESS_STATUS]
  }

  set status (status: string) {
    // $FlowFixMe: Until flow supports computed properties
    this[PROCESS_STATUS] = status
    this.emit('status', status)
  }

  terminate () {
    Object.keys(this.channels).forEach((chan) => {
      const channel = this.channels[chan]
      if (channel) {
        if (channel.onTerminate) channel.onTerminate()
      }
    })
    this.sandbox.terminate()
    this.status = 'TERMINATED'
  }

  postMessage (msg: Message) {
    this.sandbox.postMessage(msg)
  }

  openChannel (): Channel {
    let chan = id()
    // create unique channel id
    while (Object.prototype.hasOwnProperty.call(this.channels, chan)) chan = id()
    return (this.channels[chan] = { id: chan })
  }

  getChannel (chan: string): Channel {
    return this.channels[chan]
  }

  closeChannel (chan: string): void {
    delete this.channels[chan]
  }
}

/**
 * Get _Process_ object by _Pid_.
 * @param pid - _Process_ ID.
 * @returns _Process_.
 */
export function getProcess (pid: ?Pid): Process | null {
  return (pid && processes.get(pid)) || null
}

/**
 * Get _Process_ object by its iframe window.
 * @param window - Sandbox iframe window reference.
 * @returns _Process_.
 */
export function getProcessForWindow (window: WindowProxy): Process | null {
  // eslint-disable-next-line no-restricted-syntax
  for (const [pid, p] of processes.entries()) {
    if (p.sandbox.window === window) return getProcess(pid)
  }
  return null
}

export type ArgV = Array<mixed>

/**
 * Spawn a new _Process_.
 * @param path - VFS _Path_ to process script.
 * @param argv - Arguments array.
 * @returns _Process_ Id.
 */
export function spawn (path: string, argv: ArgV = []): Pid | null {
  if (typeof path !== 'string' || !Array.isArray(argv)) {
    global.console.error(`Invalid argv '${typeof argv}' for ${path}`)
    return null
  }
  global.console.log(`Spawning "${path}" ${JSON.stringify(sanitizeArgv(argv))}`)

  let pid = id()
  while (processes.has(pid)) pid = id()

  const process = new Process(pid, path.toString(), [].concat(argv))
  processes.set(pid, process)
  process.on('status', (status) => {
    if (status === 'TERMINATED') {
      processes.delete(pid)
      global.console.log(`Terminated "${path}" ${JSON.stringify(sanitizeArgv(argv))}`)
    }
  })
  return pid
}

/**
 * Mangle argv for display purposes.
 *
 * @param argv - Arguments array.
 * @returns Mangled array.
 */
export function sanitizeArgv (argv: ArgV): Array<mixed> {
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

export type ProcessInfo = {
  pid: Pid,
  path: string,
  argv: Array<mixed>,
  status: ProcessStatus,
}

/**
 * Get _Process_es information.
 *
 * @returns Process information array.
 */
export function ps (): Array<ProcessInfo> {
  return [...processes.values()].map(({
    pid, path, argv, status,
  }: any) => ({
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
