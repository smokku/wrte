let root

/* eslint-disable no-underscore-dangle */
class Window {
  constructor () {
    this._el = document.createElement('div')
    this._el.className = 'window'
    this._el.style.position = 'absolute'

    this._el.style.resize = 'both'
    this._el.style.overflow = 'auto'
    this._el.draggable = true
    this._el.ondragstart = this.dragStart.bind(this)
    this._el.ondragend = this.dragEnd.bind(this)

    this.setPosition({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
  }

  show (parent = root) {
    if (this._el.parent !== parent) {
      parent.appendChild(this._el)
    }
  }

  hide () {
    if (this._el.parent) {
      this._el.parent.removeChild(this._el)
    }
  }

  close () {
    this.hide()
  }

  setPosition (position) {
    if (position.x) this._el.style.left = `${position.x}px`
    if (position.y) this._el.style.top = `${position.y}px`
    if (position.width) this._el.style.width = `${position.width}px`
    if (position.height) this._el.style.height = `${position.height}px`
  }

  dragStart (evt) {
    this._dragStartEvent = evt
  }

  dragEnd (evt) {
    if (this._dragStartEvent) {
      const dx = evt.x - this._dragStartEvent.x
      const dy = evt.y - this._dragStartEvent.y
      this._el.style.left = `${parseInt(this._el.style.left, 10) + dx}px`
      this._el.style.top = `${parseInt(this._el.style.top, 10) + dy}px`
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
