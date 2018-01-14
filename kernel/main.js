import Sandbox from './sandbox'

export default function main () {
  window.addEventListener('message', (evt) => {
    console.log('MAIN', evt)
  })

  const logger = new Sandbox('http://localhost:8080/current/cmd/logger.js')
  setTimeout(() => logger.postMessage('testing 1 2 3'), 3000)
}
