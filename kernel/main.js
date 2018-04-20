import procInit, { spawn, ps, getProcess } from './proc'
import ipcInit from './ipc'
import vfsInit, { assign } from './vfs'

export default function main () {
  const start = window.performance.now()
  procInit()
  ipcInit()
  vfsInit()

  global.console.log(`Done in ${window.performance.now() - start}ms.`)

  // FIXME: make these assigns part of internal:autoexec
  // FIXME: and initialize local:autoexec with `source internal:autoexec`
  assign('con:foo/..', 'internal:cons/../console/')
  assign('win:', 'internal:window')

  const logger = getProcess(spawn(`${window.location.origin}/current/cmd/logger.js`))
  if (logger) {
    logger.on('status', (status) => {
      if (status === 'RUNNING') {
        global.console.log('ps', JSON.stringify(ps()))
        logger.postMessage({ payload: 'testing 1 2 3' })
        logger.postMessage({ payload: 'testing 4 5 6' })
      }
    })
  }
}
