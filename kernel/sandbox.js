// @flow strict
/* eslint-disable no-multi-assign */
import SandboxProxy from './sandbox.blob'

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

    const { origin } = window.location
    // $FlowFixMe - declared srcDoc instead srcdoc
    iframe.srcdoc = `<script>(${SandboxProxy.toString()})('${origin}', '${id}', '${path}')</script>`

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
