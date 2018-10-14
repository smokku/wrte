// @flow
/* eslint-disable unicorn/prefer-add-event-listener */
import type { Message } from '../ipc'

/**
 * WebWorker code for `internal:webdav` VFS in-process handler.
 */
export default function () {
  let init
  const CHANNELS: Map<string, string> = new Map()

  /**
   * Creates URL for requested `webdav:` VFS path.
   *
   * @param path - _Path_ to map.
   * @returns URL string.
   */
  function buildUrl (path) {
    const { argv } = init
    const schema = argv.secure ? 'https' : 'http'
    if (!Array.isArray(argv) || !argv.includes('with-host')) {
      if (!argv.auth || !argv.auth.host) {
        throw new Error(`No auth data for ${init.pid}(${init.path}):`)
      }
      // eslint-disable-next-line no-param-reassign
      path = [argv.auth.host, path].join('/')
    }
    return [schema, path].join('://')
  }

  /**
   * Create error response _Message_.
   *
   * @param error - Error type.
   * @param msg - Original _Message_ data this is a response to.
   * @returns - Error _Message_.
   */
  function buildError (error, msg) {
    const payload: { type: string, path?: string, channel?: string } = {
      type: error,
    }
    if (msg.path != null) payload.path = msg.path
    if (msg.channel != null) payload.channel = msg.channel
    const message: Message = {
      type: 'ERROR',
      process: msg.process,
      payload,
    }
    if (msg.id != null) message.id = msg.id
    return message
  }

  global.onmessage = (evt) => {
    const { data } = evt
    if (data === 'PING') {
      global.postMessage('PONG')
      return
    }
    console.debug('[webdav:]', JSON.stringify(data))
    if (data.type === 'INIT' && !init) {
      init = data.payload
      global.console.log(`[webdav:] started ${JSON.stringify(init.argv)}`)
    } else if (data.type === 'ERROR') {
      global.console.warn(`[webdav:] ERROR: ${JSON.stringify(data.payload)}`)
    } else if (
      data.type === 'CHANNEL' &&
      typeof data.channel === 'string' &&
      data.channel &&
      typeof data.path === 'string' &&
      data.path
    ) {
      // store path of open channel
      const { channel, path } = data
      CHANNELS.set(channel, path)
    } else if (
      data.type === 'READ' &&
      ((typeof data.path === 'string' && data.path) ||
        (typeof data.channel === 'string' && data.channel))
    ) {
      const path = data.channel ? CHANNELS.get(data.channel) : data.path
      const url = buildUrl(path)
      global.console.debug('[webdav:] fetching', url)
      fetch(url)
        .then((resp) => {
          if (resp.ok) {
            return resp.arrayBuffer()
          }
          throw resp.status === 404 ? 'ENOENT' : 'EPERM' // eslint-disable-line no-throw-literal
        })
        .then((resp) => {
          if (resp) {
            const message: Message = {
              type: 'DATA',
              payload: resp,
            }
            if (data.channel) {
              // respond via channel
              message.channel = data.channel
            } else {
              // respond to process
              message.process = data.process
            }
            if (data.id) message.id = data.id
            global.postMessage(message, [resp])
          }
        })
        .catch((error) => {
          // console.warn(error)
          const type = typeof error === 'string' && error.startsWith('E') ? error : 'EFAULT'
          global.postMessage(buildError(type, data))
        })
    } else {
      global.console.warn(`[webdav:] ${JSON.stringify(data)}`)
      global.postMessage(buildError('EOPNOTSUPP', data))
    }
  }
}
