let root

export function init () {
  root = document.createElement('div')
  root.id = 'console'
  root.style.position = 'absolute'
  root.style.left = '0'
  root.style.right = '0'
  root.style.top = '0'
  root.style.bottom = '0'
  document.body.appendChild(root)
  global.console.log('[console:]', 'Created root window')
}

export function handler (path, from, msg, channel) {
  // global.console.log('[console:]', msg.type, this.argv, path, from.pid, msg)
  if (msg.type === 'DATA' && typeof msg.payload === 'string') {
    root.innerText += `${msg.payload}\n`
  }
}
