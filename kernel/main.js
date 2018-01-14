import { spawn, ps } from './proc'

export default function main () {
  const logger = spawn('http://localhost:8080/current/cmd/logger.js')
  setTimeout(() => {
    console.log('ps', JSON.stringify(ps()))
    // logger.postMessage('testing 1 2 3')
  }, 1000)
}
