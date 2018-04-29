// @flow
import test from '../lib/tape'
import { getProcess, getProcessForWindow, spawn } from './proc'
import { handleMessage } from './vfs'

function setChannel (process: {}, chan: string, pid: string | null) {
  process.postMessage({
    type: 'CHANNEL',
    process: pid,
    channel: chan,
  })
}

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
            const destChan = dest.openChannel()
            const fromChan = from.openChannel()
            destChan.pid = from.pid
            destChan.endpoint = fromChan.id
            fromChan.pid = dest.pid
            fromChan.endpoint = destChan.id
            setChannel(dest, destChan.id, destChan.pid)
            setChannel(from, fromChan.id, fromChan.pid)
            destChan.onTerminate = () => setChannel(from, fromChan.id, null)
            fromChan.onTerminate = () => setChannel(dest, destChan.id, null)
            return
          }
        }

        if (channel) {
          const fromChan = from.getChannel(channel)
          if (fromChan) {
            if (fromChan.handler && fromChan.path) {
              handleMessage(fromChan.handler, fromChan.path, from, msg, fromChan)
              return
            }

            if (fromChan.endpoint && fromChan.pid) {
              const destProcess = getProcess(fromChan.pid)

              if (data.type === 'CLOSE') {
                if (destProcess) {
                  destProcess.closeChannel(fromChan.endpoint)
                }
                from.closeChannel(fromChan.id)
                setChannel(from, fromChan.id, null)
                if (destProcess) {
                  setChannel(destProcess, fromChan.endpoint, null)
                }
                return
              }

              if (destProcess) {
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
