// @flow
const EVENTS = Symbol('events')

export default class EventEmitter {
  constructor () {
    this[EVENTS] = Object.create(null)
  }

  on (event: string, cb: Function) {
    if (!this[EVENTS][event]) {
      this[EVENTS][event] = [cb]
    } else {
      this[EVENTS][event].push(cb)
    }
    return () => this.off(event, cb)
  }

  off (event: string, cb: Function) {
    if (this[EVENTS][event]) {
      this[EVENTS][event] = this[EVENTS][event].filter(fn => fn !== cb)
    }
  }

  emit (event: string, data: any) {
    if (this[EVENTS][event]) {
      this[EVENTS][event].forEach(fn => fn.call(this, data))
    }
  }
}
