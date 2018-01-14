import Sandbox from './sandbox'

export default function main () {
  console.log('main')

  const logger = new Sandbox('http://localhost:8080/current/cmd/logger.js')
}
