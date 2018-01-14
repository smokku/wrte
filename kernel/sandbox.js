/* eslint-disable func-names, no-multi-assign */
export default class Sandbox {
  constructor (url) {
    this.url = url

    const iframe = (this.iframe = document.createElement('iframe'))
    iframe.sandbox = 'allow-scripts'
    iframe.style.display = 'none'

    // eslint-disable-next-line no-shadow
    iframe.srcdoc = `<script>(${function (origin, url) {
      const blob = new window.Blob([`self.importScripts('${url}')`], {
        type: 'application/javascript'
      })
      const worker = new window.Worker(window.URL.createObjectURL(blob))
      worker.onerror = err => window.console.error(err)
      worker.onmessage = (evt) => {
        window.parent.postMessage(evt.data, origin)
      }
      window.onmessage = (evt) => {
        if (evt.origin === origin) worker.postMessage(evt.data)
      }
      window.parent.postMessage('CREATED', origin)
    }.toString()})('${window.location.origin}', '${url}')</script>`

    document.body.appendChild(iframe)
  }

  terminate () {
    document.body.removeChild(this.iframe)
  }

  postMessage (msg) {
    this.iframe.contentWindow.postMessage(msg, '*')
  }
}
