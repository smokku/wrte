import { spawn, getProcessForWindow, getProcess, sanitizeArgv } from './proc'
import { init as consoleInit, handler as consoleHandler } from './console'
import webdav from './vfs/webdav'

const handlers = Object.create(null)
const assigns = Object.create(null)

const internal = {
  console: [consoleHandler, []],
  webdav: [contentHandler, [webdav]],
}
const inits = [consoleInit]
const mounts = {
  http: ['internal:webdav', ['with-host']],
  https: ['internal:webdav', ['with-host', 'secure']],
}

export function handleMessage (handler, path, from, msg, channel) {
  if (handler.handler) {
    // process in next "tick", to make it similar to process handler type
    // and break deep/cyclic stack trace
    // eslint-disable-next-line func-names
    setTimeout(() => handler.handler(path, from, msg, channel), 0)
  } else if (handler.pid) {
    const proc = getProcess(handler.pid)
    const request = Object.assign({}, msg, {
      handler: Object.assign({ path }, handler, channel ? { channel: channel.id } : {}),
      process: from.pid,
    })
    delete request.handler.pid
    proc.postMessage(request)
  }
}

function internalHandler (path, from, msg, channel) {
  // console.debug('[internal:]', this.volume, this.argv, path, from.pid, msg, channel)
  const parts = path.split('/')
  const int = parts.shift()
  const [handler, argv = []] = (int && internal[int]) || []

  if (typeof handler === 'function') {
    handler.call({ argv }, parts.join('/'), from, msg, channel)
  } else {
    from.postMessage({
      type: 'ERROR',
      payload: {
        type: 'ENOENT',
        path: msg.path,
      },
    })
  }
}

export function contentHandler (path, from, msg, channel) {
  const [handler] = this.argv
  if (msg.type === 'READ' && typeof handler === 'function') {
    from.postMessage({
      type: 'DATA',
      payload: `(${this.argv[0].toString()})()`,
      id: msg.id,
    })
  }
}

export default function init () {
  window.console.log('Initializing VFS')

  inits.forEach(i => i())

  mount('internal', internalHandler)

  Object.entries(mounts).forEach(([vol, m]) => mount(vol, ...m))

  window.addEventListener('message', (evt) => {
    if (evt.isTrusted && evt.origin === 'null' && typeof evt.data.path === 'string') {
      // console.log('VFS', evt)
      const { source, data } = evt
      const from = getProcessForWindow(source)
      const [handler, path] = resolvePath(resolveAssigns(data.path))

      if (from) {
        if (typeof handler !== 'object') {
          from.postMessage({
            type: 'ERROR',
            payload: {
              type: 'ENODEV',
              path: data.path,
            },
          })
          return
        }

        if (data.type === 'OPEN') {
          const fromChan = from.openChannel()
          fromChan.handler = handler
          fromChan.path = path
          from.postMessage({
            type: 'CHANNEL',
            path: data.path,
            channel: fromChan.id,
          })
          return
        }

        handleMessage(handler, path, from, data, null)
      }
    }
  })
}

function checkVolumeName (volume) {
  return typeof volume === 'string' && volume.match(/^[a-z0-9]+$/)
}

export function mount (volume, handler, argv = []) {
  if (checkVolumeName(volume)) {
    if (handlers[volume]) {
      throw new Error(`${volume} is already mounted`)
    }

    window.console.debug(`Mounting ${volume}: ${
      typeof handler === 'string' ? handler : typeof handler
    } ${JSON.stringify(sanitizeArgv(argv))}`)
    switch (typeof handler) {
      case 'function':
        handlers[volume] = {
          volume,
          handler,
          argv,
        }
        break
      case 'string':
        handlers[volume] = {
          volume,
          pid: spawn(handler, argv),
          argv,
        }
        break
      default:
        throw new Error('unimplemented')
    }
  }
}

export function unmount (volume) {
  if (checkVolumeName(volume)) {
    throw new Error('unimplemented')
  }
}

export function getMounts () {
  return Object.keys(handlers).map(({
    volume, handler, pid, argv,
  }) => ({
    volume,
    handler: typeof handler,
    pid,
    argv: [].concat(argv),
  }))
}

export function assign (source, dest) {
  const sourceParts = splitPath(source.toString())
  const destParts = splitPath(dest.toString())
  if (sourceParts.length === 2 && destParts.length === 2) {
    sourceParts[1] = normalizePath(sourceParts[1])
    destParts[1] = normalizePath(destParts[1])
    /* eslint-disable no-param-reassign */
    source = sourceParts.join(':')
    dest = destParts.join(':')
    /* eslint-enable no-param-reassign */
    window.console.debug(`Assigning ${source} ${dest}`)
    assigns[source] = dest
    return true
  }
  return false
}

export function unassign (source) {
  delete assigns[source.toString()]
}

export function getAssigns () {
  return Object.keys(assigns).map(from => [from, assigns[from]])
}

export function resolvePath (full) {
  const [handler, path] = splitPath(full)
  return [(checkVolumeName(handler) && handlers[handler]) || undefined, normalizePath(path)]
}

export function splitPath (full) {
  const match = full.match(/^[a-z0-9]+:/)
  let volume
  let path
  if (match) {
    volume = match[0].slice(0, -1)
    path = full.slice(match[0].length)
  } else {
    path = full
  }
  path = path.replace(/^:+/, '')
  return [volume, path]
}

export function normalizePath (path) {
  /* eslint-disable no-param-reassign */
  path = `/${path}/`
  path = path.replace(/\/+/g, '/') // compress all //
  while (path.indexOf('/./') !== -1) {
    path = path.replace(/\/\.\//g, '/') // remove /./
  }
  while (path.indexOf('/../') !== -1) {
    path = path.replace(/[^/]*\/\.\.\//g, '/') // remove /___/../
    path = path.replace(/\/+/g, '/') // compress all / because leading /
  }
  path = path.replace(/^\/+/g, '') // remove leading /
  path = path.replace(/\/+$/g, '') // remove trailing /
  return path
  /* eslint-enable no-param-reassign */
}

export function resolveAssigns (path) {
  const unmatched = Object.assign(Object.create(null), assigns)
  let matched
  do {
    matched = false
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const ass in unmatched) {
      if (path.startsWith(ass)) {
        // eslint-disable-next-line no-param-reassign
        path = normalizePath([unmatched[ass], normalizePath(path.slice(ass.length))].join('/'))
        delete unmatched[ass]
        matched = true
        break
      }
    }
  } while (matched)
  return path
}
