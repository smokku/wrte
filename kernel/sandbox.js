// @flow
/* eslint-disable func-names, no-multi-assign */
export default class Sandbox {
  constructor (id, path) {
    this.path = path

    const iframe = (this.iframe = document.createElement('iframe'))
    iframe.id = id
    iframe.sandbox = 'allow-scripts'
    iframe.style.display = 'none'

    // eslint-disable-next-line no-shadow
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
            worker.onerror = err =>
              window.onerror(err.message, err.filename, `${err.lineno}:${err.colno}`)
            worker.onmessage = (evt) => {
              if (evt.isTrusted && typeof evt === 'object') {
                window.parent.postMessage(evt.data, origin)
              }
            }
            window.onmessage = (evt) => {
              if (evt.isTrusted && evt.origin === origin && typeof evt.data === 'object') {
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

    document.body.appendChild(iframe)
    this.window = iframe.contentWindow
  }

  terminate () {
    document.body.removeChild(this.iframe)
    this.iframe = null
    this.window = null
  }

  postMessage (msg) {
    this.window.postMessage(msg, '*')
  }
}
