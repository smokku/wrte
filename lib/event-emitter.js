// @flow strict
export type Callback = ({} | string) => void

const EVENTS: WeakMap<{}, Map<string, Array<Callback>>> = new WeakMap()

/**
 * Very simplistic EventEmitter.
 */
export default class EventEmitter {
  on (event: string, cb: Callback) {
    let events = EVENTS.get(this)
    if (!events) {
      events = new Map()
      EVENTS.set(this, events)
    }

    let handlers = events.get(event)
    if (!handlers) {
      handlers = []
      events.set(event, handlers)
    }
    handlers.push(cb)

    return () => this.off(event, cb)
  }

  off (event: string, cb: Callback) {
    const events = EVENTS.get(this)
    const handlers = events && events.get(event)
    if (events && handlers) {
      events.set(event, handlers.filter(fn => fn !== cb))
    }
  }

  emit (event: string, data: {} | string) {
    const events = EVENTS.get(this)
    const handlers = events && events.get(event)
    if (handlers) {
      handlers.forEach(fn => fn.call(this, data))
    }
  }
}
