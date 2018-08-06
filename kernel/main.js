// @flow
import procInit, { spawn, ps, getProcess } from './proc'
import ipcInit from './ipc'
import vfsInit, { assign } from './vfs'

/**
 * Web main() entry point.
 */
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

  const pid = spawn(`${window.location.origin}/current/cmd/logger.js`)
  if (pid) {
    const logger = getProcess(pid)
    if (logger) {
      logger.on('status', (status) => {
        if (status === 'RUNNING') {
          logger.postMessage({ type: 'DATA', payload: 'testing 1 2 3' })
          logger.postMessage({ type: 'DATA', payload: 'testing 4 5 6' })
          setTimeout(() => {
            global.console.group('ps()')
            ps().forEach(proc => global.console.log(proc))
            global.console.groupEnd()
          }, 500)
        }
      })
    }
  }
}
