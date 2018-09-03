// @flow
/* eslint-disable no-underscore-dangle */
import EventEmitter from './event-emitter'

export type Rect = {
  x: number,
  y: number,
  width: number,
  height: number,
}

/**
 * Creates application _Window_ visible to the user.
 * Handles interactions by emitting events.
 */
export default class Window extends EventEmitter {
  _frame: HTMLIFrameElement

  _body: HTMLElement

  _content: HTMLElement

  _dragStartEvent: DragEvent

  preventKeys: Array<string>

  constructor () {
    super()

    this._frame = document.createElement('iframe')
    this._frame.sandbox.add('allow-same-origin')
    this._frame.sandbox.add('allow-scripts')
    this._frame.className = 'window'
    this._frame.style.position = 'absolute'

    this._frame.style.resize = 'both'
    this._frame.draggable = true
    this._frame.addEventListener('dragstart', this.dragStart.bind(this))
    this._frame.addEventListener('dragend', this.dragEnd.bind(this))

    this.setPosition({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })

    this.preventKeys = []
  }

  show (parent: ?HTMLElement) {
    if (parent && this._frame.parentNode !== parent) {
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
        this._body.addEventListener('keypress', this.onKeyPress.bind(this))
        this._body.addEventListener('focus', () => this._frame.focus())
        this._body.appendChild(this._content)
      }
    }
  }

  hide () {
    if (this._frame.parentNode) {
      this._frame.parentNode.removeChild(this._frame)
    }
  }

  close () {
    this.hide()
  }

  setPosition (position: Rect) {
    if (position.x != null) this._frame.style.left = `${position.x}px`
    if (position.y != null) this._frame.style.top = `${position.y}px`
    if (position.width != null) this._frame.style.width = `${position.width}px`
    if (position.height != null) this._frame.style.height = `${position.height}px`
  }

  dragStart (evt: DragEvent) {
    this._dragStartEvent = evt
  }

  dragEnd (evt: DragEvent) {
    if (this._dragStartEvent) {
      const dx = evt.screenX - this._dragStartEvent.screenX
      const dy = evt.screenY - this._dragStartEvent.screenY
      this._frame.style.left = `${parseInt(this._frame.style.left, 10) + dx}px`
      this._frame.style.top = `${parseInt(this._frame.style.top, 10) + dy}px`
      delete this._dragStartEvent
    }
  }

  onKeyPress (evt: KeyboardEvent) {
    const { key } = evt
    if (this.preventKeys.includes(key)) {
      evt.preventDefault()
    }
    this.emit('key', key)
  }
}
