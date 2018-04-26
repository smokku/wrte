import EventEmitter from './event-emitter'
import { handleMessage } from './vfs'

let root

/* eslint-disable no-underscore-dangle */
class Window extends EventEmitter {
  constructor () {
    super()

    this._frame = document.createElement('iframe')
    this._frame.seamless = true
    this._frame.sandbox = 'allow-same-origin allow-scripts'
    this._frame.className = 'window'
    this._frame.style.position = 'absolute'

    this._frame.style.resize = 'both'
    this._frame.draggable = true
    this._frame.ondragstart = this.dragStart.bind(this)
    this._frame.ondragend = this.dragEnd.bind(this)

    this.setPosition({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })

    this.preventKeys = []
  }

  show (parent = root) {
    if (this._frame.parent !== parent) {
      parent.appendChild(this._frame)

      if (!this._body) {
        this._body = this._frame.contentWindow.document.body
        this._body.style.margin = '0'
        this._body.style.padding = '0'
        this._body.style.display = 'flex'
        this._content = this._frame.contentWindow.document.createElement('code')
        this._content.contentEditable = true
        this._content.style.flex = '1 1 0'
        this._content.style.resize = 'none'
        this._content.style.overflow = 'auto'
        this._content.style.border = 'none'
        this._content.style.outline = 'none'
        this._body.onkeypress = this.onKeyPress.bind(this)
        this._body.onfocus = () => this._frame.focus()
        this._body.appendChild(this._content)
      }
    }
  }

  hide () {
    if (this._frame.parent) {
      this._frame.parent.removeChild(this._frame)
    }
  }

  close () {
    this.hide()
  }

  setPosition (position) {
    if (position.x != null) this._frame.style.left = `${position.x}px`
    if (position.y != null) this._frame.style.top = `${position.y}px`
    if (position.width != null) this._frame.style.width = `${position.width}px`
    if (position.height != null) this._frame.style.height = `${position.height}px`
  }

  dragStart (evt) {
    this._dragStartEvent = evt
  }

  dragEnd (evt) {
    if (this._dragStartEvent) {
      const dx = evt.x - this._dragStartEvent.x
      const dy = evt.y - this._dragStartEvent.y
      this._frame.style.left = `${parseInt(this._frame.style.left, 10) + dx}px`
      this._frame.style.top = `${parseInt(this._frame.style.top, 10) + dy}px`
      delete this._dragStartEvent
    }
  }

  onKeyPress (evt) {
    const { key } = evt
    if (this.preventKeys.includes(key)) {
      evt.preventDefault()
    }
    this.emit('key', key)
  }
}
/* eslint-enable no-underscore-dangle */

export function init () {
  root = document.body
  global.console.log('[window:]', 'Obtained BODY reference')
}

export function handler (path, from, msg, channel) {
  global.console.log('[window:]', msg.type, this.argv, path, from.pid, msg, channel)
  const { type, payload } = msg
  const { position } = typeof payload === 'object' ? payload : {}
  const { meta } = channel
  let win
  switch (type) {
    case 'OPEN':
      if (!meta) {
        win = new Window()
        // eslint-disable-next-line no-param-reassign
        channel.meta = {
          window: win,
          pid: from.pid,
        }
        win.on('key', (key) => {
          const data = {
            type: 'KEY',
            payload: {
              type: 'PRESS',
              key,
            },
          }
          handleMessage(channel.handler, path, from, data, channel)
        })
      } else {
        win = meta.window
      }
      if (position) win.setPosition(position)
      win.show()
      break
    default:
      global.console.warn(`[window:] unhandled message: ${JSON.stringify(msg)}`)
  }
}
