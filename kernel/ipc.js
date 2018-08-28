// @flow
import test from '../lib/tape'

import type { Process, Pid } from './proc'

import { getProcess, getProcessForWindow, spawn } from './proc'

export type MessageType = 'INIT' | 'ERROR' | 'DATA' | 'CHANNEL' | 'EVENT'

export type Message = {
  type: MessageType,
  id?: string,
  payload?: string | Object | ArrayBuffer,
  process?: Pid | null,
  path?: string | null,
  channel?: Cid,
}

/**
 * Build a reply to a _Message_.
 *
 * @param reply - Reply _Message_ to be filled.
 * @param message - _Message_ instance reply is a response to.
 * @returns Reply _Message_.
 */
export function makeReply (reply: Message, message: Message): Message {
  if (message.id != null) {
    reply.id = message.id
  }
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
 * @export
 * @type Channel
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
 * Handler function
 * @arg to - _Path_ or _Channel_ the _message_ belongs to.
 * @arg from - _Process_ sending the _message_.
 * @arg msg - _Message_ object.
 */
export type Handler = (to: Pid | Channel, from: Process, msg: Message) => void

/**
 * Helper function to notify a _Process_ about new _Channel_ creation.
 *
 * @param process - _Process_ object instance.
 * @param chan - _Channel_ ID.
 * @param pid - _Process_ ID (if known).
 */
function notifyNewChannel (process: Process, chan: Cid, pid?: Pid | null): void {
  process.postMessage({
    type: 'CHANNEL',
    process: pid,
    channel: chan,
  })
}

/**
 * IPC init()ialization.
 */
export default function init () {
  global.console.log('Initializing IPC')

  window.addEventListener('message', (evt) => {
    if (
      evt.isTrusted &&
      evt.origin === 'null' &&
      typeof evt.data.type === 'string' &&
      (typeof evt.data.process === 'string' || typeof evt.data.channel === 'string')
    ) {
      // console.log('IPC', evt)
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
            destChan.pid = from.pid
            destChan.endpoint = fromChan.id
            fromChan.pid = dest.pid
            fromChan.endpoint = destChan.id
            notifyNewChannel(dest, destChan.id, destChan.pid)
            notifyNewChannel(from, fromChan.id, fromChan.pid)
            destChan.onTerminate = () => notifyNewChannel(fromProcess, fromChan.id, null)
            fromChan.onTerminate = () => notifyNewChannel(destProcess, destChan.id, null)
            return
          }
        }

        if (channel) {
          const fromChan = from.getChannel(channel)
          if (fromChan) {
            if (typeof fromChan.handler === 'function' && typeof fromChan.path === 'string') {
              fromChan.handler(fromChan, from, msg)
              return
            }

            if (fromChan.endpoint && fromChan.pid) {
              const destProcess = getProcess(fromChan.pid)

              if (data.type === 'CLOSE') {
                if (destProcess && fromChan.endpoint) {
                  destProcess.closeChannel(fromChan.endpoint)
                }
                from.closeChannel(fromChan.id)
                notifyNewChannel(from, fromChan.id, null)
                if (destProcess && fromChan.endpoint) {
                  notifyNewChannel(destProcess, fromChan.endpoint, null)
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
  })
}

test('channel', (t) => {
  const other = spawn(`${window.location.origin}/current/test/channel.js`)
  t.ok(other)
  spawn(`${window.location.origin}/current/test/channel.js`, [other])
  t.end()
})
