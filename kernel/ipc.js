// @flow
import type { Process, Pid } from './proc'
import type { Handler } from './vfs'

import { getProcess, getProcessForWindow } from './proc'

export type MessageType = 'INIT' | 'ERROR' | 'READ' | 'DATA' | 'OPEN' | 'CLOSE' | 'CHANNEL' | 'EVENT'

export type Message = {
  type: MessageType,
  id?: string,
  payload?: string | Object | ArrayBuffer,
  process?: Pid | null,
  path?: string | null,
  channel?: Cid,
}

/**
 * Copy attributes needed for a reply to a _Message_.
 *
 * @param reply - Reply _Message_ to be filled.
 * @param message - _Message_ instance reply is a response to.
 * @returns Reply _Message_.
 */
export function fillReply (reply: Message, message: Message): Message {
  if (message.id != null) {
    reply.id = message.id
  }
  return reply
}

/**
 * Build a reply to a _Message_.
 *
 * @param reply - Reply _Message_ to be filled.
 * @param message - _Message_ instance reply is a response to.
 * @returns Reply _Message_.
 */
export function makeReply (reply: Message, message: Message): Message {
  reply = fillReply(reply, message)
  if (message.channel != null) {
    reply.channel = message.channel
  } else if (message.process != null) {
    reply.process = message.process
  }
  return reply
}

/**
 * Build an error reply to a _Message_.
 *
 * @param error - _Error_ type to be returned.
 * @param message - _Message_ instance error is a response to.
 * @returns Error _Message_.
 */
export function errorReply (error: string, message: Message): Message {
  const reply: Message = {
    type: 'ERROR',
    payload: {
      type: error.toString(),
      message,
    },
  }
  return makeReply(reply, message)
}

/// _Channel_ ID
export type Cid = string

/**
 * Channel type.
 * Describes two-way communication channel between processes
 * or process and path handler
 *
 * @prop id - ID used by owning process
 * @prop pid - {Process} ID this channel routes messages to
 * @prop endpoint - {Channel} ID used by the other end
 * @prop path - {Path} in the handler this channel routes messages to
 * @prop onTerminate - function to call when channel is terminated by closing the other end
 * @prop handler - `internal:` VFS handler object
 * @prop meta - `internal:` handler owned data, used for {Channel} bookkeeping
 * @prop send - `internal:` handler function to send reply over {Channel}
 */
export type Channel = {
  id: Cid,
  pid?: Pid,
  endpoint?: Pid,
  path?: string,
  onTerminate?: () => void,
  handler?: Handler,
  meta?: Object,
  send?: (msg: Message) => void,
}

/**
 * Helper function to notify a _Process_ about new _Channel_ creation.
 *
 * @param process - _Process_ object instance.
 * @param channel - _Channel_ ID.
 * @param data - _Channel_ data (process: _Pid_ or path: _Path_).
 * @param message - OPEN _Message_ it is a reply to.
 */
export function notifyNewChannel (
  process: Process,
  channel: Cid,
  data: { [string]: string | null },
  message: Message
): void {
  if (message.type === 'OPEN' || message.type === 'CLOSE') {
    process.postMessage(
      fillReply(
        {
          ...data,
          type: 'CHANNEL',
          channel,
        },
        message
      )
    )
  }
}

/**
 * IPC init()ialization.
 */
export default function init () {
  global.console.log('Initializing IPC')
  window.addEventListener('message', messageHandler)
}

/**
 * IPC window message receiver.
 * @param evt - WindowMessage event.
 */
function messageHandler (evt) {
  if (
    evt.isTrusted &&
    evt.origin === 'null' &&
    typeof evt.data.type === 'string' &&
    evt.data.type &&
    (typeof evt.data.process === 'string' || typeof evt.data.channel === 'string') &&
    evt.data.path == null
  ) {
    // console.debug('IPC', evt)
    const { source, data } = evt
    const from = getProcessForWindow(source)

    if (from) {
      const { process, channel } = data
      if (process && channel) return

      const msg = Object.assign({}, data)
      msg.process = from.pid
      delete msg.channel

      let dest

      if (process) {
        dest = getProcess(process)

        if (dest && data.type === 'OPEN') {
          const fromProcess = from
          const destProcess = dest
          const destChan = dest.openChannel()
          const fromChan = from.openChannel()
          const destChanPid = from.pid
          const fromChanPid = dest.pid
          destChan.pid = destChanPid
          destChan.endpoint = fromChan.id
          fromChan.pid = fromChanPid
          fromChan.endpoint = destChan.id
          notifyNewChannel(dest, destChan.id, { process: destChanPid }, data)
          notifyNewChannel(from, fromChan.id, { process: fromChanPid }, data)
          // eslint-disable-next-line max-len
          destChan.onTerminate = () => notifyNewChannel(fromProcess, fromChan.id, { process: null }, data)
          // eslint-disable-next-line max-len
          fromChan.onTerminate = () => notifyNewChannel(destProcess, destChan.id, { process: null }, data)
          return
        }
      }

      if (channel) {
        const fromChan = from.getChannel(channel)
        if (fromChan) {
          if (typeof fromChan.handler === 'function' && typeof fromChan.path === 'string') {
            fromChan.handler(fromChan, from, msg)

            /* closing internal: process-less channel */
            if (data.type === 'CLOSE') {
              notifyNewChannel(from, fromChan.id, { path: null }, data)
              from.closeChannel(fromChan.id)
            }
            return
          }

          if (fromChan.endpoint && fromChan.pid) {
            const destProcess = getProcess(fromChan.pid)

            if (data.type === 'CLOSE') {
              if (destProcess && fromChan.endpoint) {
                destProcess.closeChannel(fromChan.endpoint)
              }
              from.closeChannel(fromChan.id)
              notifyNewChannel(from, fromChan.id, { process: null }, data)
              if (destProcess && fromChan.endpoint) {
                notifyNewChannel(destProcess, fromChan.endpoint, { process: null }, data)
              }
              return
            }

            if (destProcess && fromChan.endpoint) {
              const destChan = destProcess.getChannel(fromChan.endpoint)
              if (destChan.pid === from.pid && destChan.endpoint === fromChan.id) {
                dest = destProcess
                msg.channel = destChan.id
              }
            }
          }
        }
      }

      if (dest) {
        dest.postMessage(msg)
      } else {
        from.postMessage({
          type: 'ERROR',
          payload: {
            type: 'ESRCH',
            process,
            channel,
          },
        })
      }
    }
  }
}
