import procInit, { spawn, ps, getProcess } from './proc'
import ipcInit from './ipc'
import vfsInit, { assign } from './vfs'

export default function main () {
  procInit()
  ipcInit()
  vfsInit()

  assign('con:foo/..', 'internal:cons/../console/')

  const logger = spawn('http://localhost:8080/current/cmd/logger.js')
  setTimeout(() => {
    console.log('ps', JSON.stringify(ps()))
    const loggerProc = getProcess(logger)
    if (loggerProc) {
      loggerProc.postMessage('testing 1 2 3')
      loggerProc.postMessage('testing 4 5 6')
    }
  }, 1000)
}
