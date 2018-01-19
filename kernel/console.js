let root

export function init () {
  root = document.body
  window.console.debug('[console:]', 'Obtained BODY reference')
}

export function handler (path, from, msg, channel) {
  // window.console.debug('[console:]', msg.type, this.volume, this.args, path, from.pid, msg)
  if (msg.type === 'DATA' && typeof msg.payload === 'string') {
    root.innerText += `${msg.payload}\n`
  }
}
