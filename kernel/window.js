let root

/* eslint-disable no-underscore-dangle */
class Window {
  constructor () {
    this._frame = document.createElement('iframe')
    this._frame.seamless = true
    this._frame.sandbox = 'allow-same-origin'
    this._frame.className = 'window'
    this._frame.style.position = 'absolute'

    this._frame.style.resize = 'both'
    this._frame.style.overflow = 'auto'
    this._frame.draggable = true
    this._frame.ondragstart = this.dragStart.bind(this)
    this._frame.ondragend = this.dragEnd.bind(this)

    this.setPosition({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
  }

  show (parent = root) {
    if (this._frame.parent !== parent) {
      parent.appendChild(this._frame)
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
    if (position.x) this._frame.style.left = `${position.x}px`
    if (position.y) this._frame.style.top = `${position.y}px`
    if (position.width) this._frame.style.width = `${position.width}px`
    if (position.height) this._frame.style.height = `${position.height}px`
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
}
/* eslint-enable no-underscore-dangle */

export function init () {
  root = document.body
  window.console.debug('[window:]', 'Obtained BODY reference')
}

export function handler (path, from, msg, channel) {
  // window.console.debug('[window:]', msg.type, this.argv, path, from.pid, msg, channel)
  const { type, payload } = msg
  const { position } = payload || {}
  let { window: win } = channel
  switch (type) {
    case 'OPEN':
      if (!win) {
        // eslint-disable-next-line no-multi-assign, no-param-reassign
        win = channel.window = new Window()
      }
      if (position) win.setPosition(position)
      win.show()
      break
    default:
    // pass
  }
}
