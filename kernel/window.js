// @flow
import EventEmitter from './event-emitter'

/* eslint-disable no-underscore-dangle */
export default class Window extends EventEmitter {
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

  show (parent: {}) {
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
