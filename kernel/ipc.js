import { getProcess, getProcessForWindow } from './proc'
import { handleMessage } from './vfs'

export default function init () {
  global.console.log('Initializing IPC')

  window.addEventListener('message', (evt) => {
    if (
      evt.isTrusted &&
      evt.origin === 'null' &&
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

          if (data.type === 'OPEN') {
            const destChan = dest.openChannel()
            const fromChan = from.openChannel()
            destChan.pid = from.pid
            destChan.endpoint = fromChan.id
            fromChan.pid = dest.pid
            fromChan.endpoint = destChan.id
            dest.postMessage({
              type: 'CHANNEL',
              process: destChan.pid,
              channel: destChan.id,
            })
            from.postMessage({
              type: 'CHANNEL',
              process: fromChan.pid,
              channel: fromChan.id,
            })
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
                from.postMessage({
                  type: 'CHANNEL',
                  process: null,
                  channel: fromChan.id,
                })
                if (destProcess) {
                  destProcess.postMessage({
                    type: 'CHANNEL',
                    process: null,
                    channel: fromChan.endpoint,
                  })
                }
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
