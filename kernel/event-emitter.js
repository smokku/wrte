// @flow strict
export type Callback = ({} | string) => void

const EVENTS = Symbol('events')

/**
 * Very simplistic EventEmitter.
 */
export default class EventEmitter {
  EVENTS: { [string]: Callback }

  constructor () {
    // $FlowFixMe: Until flow supports computed properties
    this[EVENTS] = Object.create(null) // FIXME: replace with WeakMap()
  }

  on (event: string, cb: Callback) {
    // $FlowFixMe: Until flow supports computed properties
    if (!this[EVENTS][event]) {
      // $FlowFixMe: Until flow supports computed properties
      this[EVENTS][event] = [cb]
    } else {
      // $FlowFixMe: Until flow supports computed properties
      this[EVENTS][event].push(cb)
    }
    return () => this.off(event, cb)
  }

  off (event: string, cb: Callback) {
    // $FlowFixMe: Until flow supports computed properties
    if (this[EVENTS][event]) {
      // $FlowFixMe: Until flow supports computed properties
      this[EVENTS][event] = this[EVENTS][event].filter(fn => fn !== cb)
    }
  }

  emit (event: string, data: {} | string) {
    // $FlowFixMe: Until flow supports computed properties
    if (this[EVENTS][event]) {
      // $FlowFixMe: Until flow supports computed properties
      this[EVENTS][event].forEach(fn => fn.call(this, data))
    }
  }
}
