// @flow strict
/**
 * IFrame proxy code for WebWorker.
 * This code works in an IFrame sandbox as an intermediary between kernel
 * and process code working in WebWorker it creates.
 *
 * @param origin - Origin of parent window.
 * @param name - Name of WebWorker inside (for tracking purposes).
 * @param path - Originating code path (for logging purposes).
 */
export default function (origin: string, name: string, path: string): void {
  window.msgQueue = []
  window.onmessage = (msg) => {
    if (msg.isTrusted && msg.origin === origin && typeof msg.data === 'object') {
      const { data } = msg
      if (data.type === 'DATA' && data.id === name) {
        const blob = new window.Blob([data.payload], {
          type: 'application/javascript',
        })
        const worker = new window.Worker(window.URL.createObjectURL(blob), { name })
        worker.onerror = err => window.onerror(err.message, err.filename, `${err.lineno}:${err.colno}`)
        worker.onmessage = (evt) => {
          if (evt.isTrusted && typeof evt === 'object') {
            if (evt.data === 'PONG') {
              window.lastPong = Date.now()
            }
            if (evt.data === 'TERMINATE' || typeof evt.data === 'object') {
              window.parent.postMessage(evt.data, origin)
            }
          }
        }
        window.lastPong = Date.now()
        setInterval(() => {
          worker.postMessage('PING')
          if (Date.now() - window.lastPong > 2000) {
            // eslint-disable-next-line max-len
            window.console.error(`${name}(${path}) failed PING/PONG reply since ${window.lastPong}`)
            window.parent.postMessage('TERMINATE', origin)
          }
        }, 1000)
        /* NOTICE: This onmessage handler replaces the one above
         * and is also called manually from queue below. */
        window.onmessage = (evt) => {
          if (
            evt.isTrusted &&
            evt.origin === origin &&
            typeof evt === 'object' &&
            typeof evt.data === 'object'
          ) {
            if (window.msgQueue) {
              if (evt.data.type === 'INIT') {
                const { msgQueue } = window
                delete window.msgQueue
                worker.postMessage(evt.data)
                msgQueue.forEach(window.onmessage)
              } else {
                window.msgQueue.push(evt)
              }
            } else {
              worker.postMessage(evt.data)
            }
          }
        }
        window.parent.postMessage('CREATED', origin)
      } else if (data.type === 'ERROR' && typeof data.payload === 'object' && data.id === name) {
        throw new Error(`Failed loading ${path}: ${data.payload.type}`)
      } else {
        window.msgQueue.push(msg)
      }
    }
  }
  window.onerror = (err, url, lineNumber) => {
    setTimeout(() => window.parent.postMessage('TERMINATE', origin), 0)
    window.console.error(
      `${name}(${path}) ${url || '?'}:${lineNumber || '?'} ${err.message || err.toString()}`
    )
    return true
  }
  window.parent.postMessage({ type: 'READ', path, id: name }, origin)
}
