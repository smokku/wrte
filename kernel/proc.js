import Sandbox from './sandbox'
import id from '../lib/id'

export default function init () {
  window.console.log('Initializing PROC')

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
                path: proc.path,
                argv: proc.argv,
                channels: Object.keys(proc.channels),
              },
            })
            proc.status = 'RUNNING'
            break
          default:
          // drop
        }
      }
    }
  })
}

const processes = Object.create(null)

export class Process {
  constructor (pid, path, argv) {
    this.pid = pid
    this.path = path
    this.argv = argv
    this.status = 'SPAWNING'
    this.sandbox = new Sandbox(pid, path)
    this.channels = Object.create(null)
  }

  postMessage (msg) {
    return this.sandbox.postMessage(msg)
  }

  openChannel () {
    let chan = id()
    while (Object.prototype.hasOwnProperty.call(this.channels, chan)) chan = id()
    return (this.channels[chan] = { id: chan })
  }

  getChannel (chan) {
    return this.channels[chan.toString()]
  }

  closeChannel (chan) {
    delete this.channels[chan.toString()]
  }
}

export function getProcess (pid) {
  return processes[pid]
}

export function getProcessForWindow (window) {
  const pid = Object.keys(processes).find(p => processes[p].sandbox.window === window)
  return pid && getProcess(pid)
}

export function spawn (path, argv = []) {
  console.debug(`Spawning ${path}`)

  let pid = id()
  while (Object.prototype.hasOwnProperty.call(processes, pid)) pid = id()

  processes[pid] = new Process(pid, path.toString(), [].concat(argv))
  return pid
}

export function ps () {
  return Object.values(processes).map(({
    pid, path, argv, status,
  }) => ({
    pid,
    path,
    argv,
    status,
  }))
}
