import procInit, { spawn, ps, getProcess } from './proc'
import ipcInit from './ipc'
import vfsInit, { assign } from './vfs'

export default function main () {
  const start = window.performance.now()
  procInit()
  ipcInit()
  vfsInit()

  window.console.log(`Done in ${window.performance.now() - start}ms.`)

  assign('con:foo/..', 'internal:cons/../console/')

  const logger = spawn('http://localhost:8080/current/cmd/logger.js')
  setTimeout(() => {
    console.log('ps', JSON.stringify(ps()))
    const loggerProc = getProcess(logger)
    if (loggerProc) {
      loggerProc.postMessage({ payload: 'testing 1 2 3' })
      loggerProc.postMessage({ payload: 'testing 4 5 6' })
    }
  }, 1000)
}
