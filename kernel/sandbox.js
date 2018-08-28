// @flow strict
/* eslint-disable func-names, no-multi-assign, unicorn/prefer-add-event-listener */

declare class DOMException {
  +message: string;
  +name: string;
  constructor(message: string, name: string): void;
}

/**
 * _Process_ _Sandbox_ is responsible for launching an untrusted process
 * in WebWorker thread and jailing it in IFrame sandbox.
 * This restricts what a _Process_ can do to what is allowed to WebWorker
 * thread (not much besides web access) and what is accessible by sending
 * and receiving messages from the kernel (and indirectly other _Process_es).
 */
export default class Sandbox {
  path: string

  iframe: ?HTMLIFrameElement

  window: ?WindowProxy

  constructor (id: string, path: string) {
    this.path = path

    const iframe = (this.iframe = document.createElement('iframe'))
    iframe.id = id
    iframe.sandbox.add('allow-scripts')
    iframe.style.display = 'none'

    // eslint-disable-next-line no-shadow, // $FlowFixMe - declared srcDoc instead srcdoc
    iframe.srcdoc = `<script>(${function (origin, name, path) {
      window.msgQueue = []
      window.onmessage = (msg) => {
        if (msg.isTrusted && msg.origin === origin && typeof msg.data === 'object') {
          const { data } = msg
          if (data.type === 'DATA' && data.id === 'source') {
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
                window.console.error(
                  `${name}(${path}) failed PING/PONG reply since ${window.lastPong}`
                )
                window.parent.postMessage('TERMINATE', origin)
              }
            }, 1000)
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
          } else if (
            data.type === 'ERROR' &&
            typeof data.payload === 'object' &&
            data.payload.path === path
          ) {
            throw new Error(`Failed loading ${path}: ${data.payload.type}`)
          } else {
            window.msgQueue.push(msg)
          }
        }
      }
      window.onerror = (err, url, lineNumber) => {
        setTimeout(() => window.parent.postMessage('TERMINATE', origin), 0)
        return window.console.error(`${name}(${path}) ${url}:${lineNumber} ${err}`)
      }
      window.parent.postMessage({ type: 'READ', path, id: 'source' }, origin)
    }.toString()})('${window.location.origin}', '${id}', '${path}')</script>`

    document.body && document.body.appendChild(iframe)
    this.window = iframe.contentWindow

    /* test whether iframe sandbox actually works */
    let sandboxTestPassed = false
    try {
      this.window.document // eslint-disable-line no-unused-expressions
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        sandboxTestPassed = true
      }
    }
    if (!sandboxTestPassed) {
      throw new DOMException(`${id}(${path}) IFrame sandbox does not work`, 'SecurityError')
    }
  }

  terminate () {
    this.iframe && document.body && document.body.removeChild(this.iframe)
    this.iframe = null
    this.window = null
  }

  postMessage (msg: {}) {
    if (this.window) {
      this.window.postMessage(msg, '*')
    }
  }
}
