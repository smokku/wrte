import Sandbox from './sandbox'
import id from '../lib/id'

const processes = Object.create(null)

export class Process {
  constructor (pid, argv) {
    this.pid = pid
    this.argv = argv
    this.status = 'SPAWNING'
    this.sandbox = new Sandbox(pid, argv[0])
  }
}

export function spawn (path, argv = []) {
  console.debug(`Spawning ${path}`)

  let pid = id()
  while (Object.prototype.hasOwnProperty.call(processes, pid)) {
    pid = id()
  }

  processes[pid] = new Process(pid, [path].concat(argv))
  return pid
}

window.addEventListener('message', (evt) => {
  // console.log('PROC', evt)
  if (evt.isTrusted && evt.origin === 'null') {
    const { source, data } = evt
    const pid = Object.keys(processes).find(p => processes[p].sandbox.window === source)

    if (pid) {
      const proc = processes[pid]

      if (typeof data === 'string') {
        switch (data) {
          case 'CREATED':
            proc.sandbox.postMessage({
              type: 'ARGV',
              payload: proc.argv
            })
            proc.status = 'RUNNING'
            break
          default:
          // drop
        }
      }
    }
  }
})

export function ps () {
  return Object.values(processes).map(({ pid, argv, status }) => ({
    pid,
    argv,
    status
  }))
}
