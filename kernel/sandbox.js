/* eslint-disable func-names, no-multi-assign */
export default class Sandbox {
  constructor (id, url) {
    this.url = url

    const iframe = (this.iframe = document.createElement('iframe'))
    iframe.id = id
    iframe.sandbox = 'allow-scripts'
    iframe.style.display = 'none'

    // eslint-disable-next-line no-shadow
    iframe.srcdoc = `<script>(${function (origin, name, url) {
      const blob = new window.Blob([`self.importScripts('${url}')`], {
        type: 'application/javascript',
      })
      const worker = new window.Worker(window.URL.createObjectURL(blob), { name })
      worker.onerror = err => window.console.error(err)
      worker.onmessage = (evt) => {
        if (typeof evt === 'object') window.parent.postMessage(evt.data, origin)
      }
      window.onmessage = (evt) => {
        if (evt.origin === origin) worker.postMessage(evt.data)
      }
      window.parent.postMessage('CREATED', origin)
    }.toString()})('${window.location.origin}', '${id}', '${url}')</script>`

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
