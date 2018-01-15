import procInit, { spawn, ps } from './proc'
import ipcInit from './ipc'
import vfsInit from './vfs'

export default function main () {
  procInit()
  ipcInit()
  vfsInit()

  const logger = spawn('http://localhost:8080/current/cmd/logger.js')
  setTimeout(() => {
    console.log('ps', JSON.stringify(ps()))
    // logger.postMessage('testing 1 2 3')
  }, 1000)
}
