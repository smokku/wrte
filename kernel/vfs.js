// @flow
import test from '../lib/tape'

import type { Message, Channel, Handler } from './types'
import type { Process } from './proc'

import {
  spawn, getProcessForWindow, getProcess, sanitizeArgv,
} from './proc'
import { errorReply, makeReply } from './ipc'

import { init as consoleInit, handler as consoleHandler } from './internal/console'
import { init as windowInit, handler as windowHandler } from './internal/window'

import webdav from './vfs/webdav'

const mounts: {| [string]: Handler |} = (Object.create(null): any)
const assigns: {| [string]: string |} = (Object.create(null): any)

const internal = {
  console: [consoleHandler],
  window: [windowHandler],
  webdav: [contentHandler, webdav],
}
const inits = [consoleInit, windowInit]
const initialMounts = {
  http: ['internal:webdav', ['with-host']],
  https: ['internal:webdav', ['with-host', 'secure']],
}

/**
 * Handler function for `internal:` _volume_.
 * This is a dispatcher to `internal{}` handler functions mapped as subdirectories
 * of `internal:` volume. These are usually _assign_ed as own _volume_s, i.e.
 * `internal:console` assigned as `console:`, etc.
 *
 * @param to - Request destination. Either _Channel_ or _Path_.
 *             First part of path is an index in internal handlers map.
 * @param from - Requesting _Process_.
 * @param msg - Request _Message_.
 */
function internalHandler (to: Pid | Channel, from: Process, msg: Message): void {
  const fullPath = typeof to === 'object' ? to.path : to
  // console.debug('[internal:]', fullPath, from.pid, msg)
  if (typeof fullPath === 'string') {
    const parts = fullPath.split('/')
    const int = parts.shift()
    const [handler, ...argv] = (int && internal[int]) || []
    const path = parts.join('/')

    if (typeof handler === 'function') {
      handler.call({ argv }, typeof to === 'object' ? { ...to, path } : path, from, msg)
    } else {
      from.postMessage(errorReply('ENOENT', msg))
    }
  }
}

/**
 * Handler function for built-in VFS process handlers. It serves the content
 * of virtual `internal:` file to be launched as VFS handler process.
 *
 * @param to - Request destination. Either _Channel_ or _Path_.
 * @param from - Requesting _Process_.
 * @param msg - Request _Message_.
 */
export function contentHandler (to: Pid | Channel, from: Process, msg: Message): void {
  const [handler] = this.argv
  if (msg.type === 'READ' && typeof handler === 'function') {
    from.postMessage(
      makeReply(
        {
          type: 'DATA',
          payload: `(${handler.toString()})()`,
        },
        msg
      )
    )
  } else {
    from.postMessage(errorReply('EINVAL', msg))
  }
}

/**
 * VFS init()ialization.
 */
export default function init () {
  global.console.log('Initializing VFS')

  inits.forEach(i => i())

  mount('internal', internalHandler)

  // $FlowFixMe - spread not fully supported yet
  Object.entries(initialMounts).forEach(([vol, m]) => mount(vol, ...m))

  window.addEventListener('message', (evt) => {
    if (
      evt.isTrusted &&
      evt.origin === 'null' &&
      typeof evt.data === 'object' &&
      typeof evt.data.path === 'string'
    ) {
      // console.log('VFS', evt)
      const { source, data } = evt
      const from = getProcessForWindow(source)
      const [handler, path] = resolvePath(resolveAssigns(data.path))
      let channel: ?Channel = null

      if (from) {
        if (typeof handler !== 'function') {
          from.postMessage(errorReply('ENODEV', data))
        } else {
          if (data.type === 'OPEN') {
            channel = from.openChannel()
            channel.handler = handler
            channel.path = path
            channel.send = function send (msg: Message) {
              global.console.log('>>>>>>>>>>', msg)
            }
            from.postMessage(
              makeReply(
                {
                  type: 'CHANNEL',
                  path: data.path,
                  channel: channel.id,
                },
                data
              )
            )
            handler(channel, from, data)
            return
          }

          if (typeof data.channel === 'string') {
            channel = from.getChannel(data.channel)
          }

          if (data.type === 'CLOSE' && channel) {
            handler(channel, from, data)
            from.postMessage(
              makeReply(
                {
                  type: 'CHANNEL',
                  path: null,
                  channel: channel.id,
                },
                data
              )
            )
            from.closeChannel(channel.id)
            return
          }

          handler(channel || path, from, data)
        }
      }
    }
  })
}

function checkVolumeName (volume: ?string): boolean %checks {
  return typeof volume === 'string' && !!volume.match(/^[a-z0-9]+$/)
}

export function mount (volume: string, handler: string | Handler, argv: Array<mixed> = []) {
  if (checkVolumeName(volume)) {
    if (mounts[volume]) {
      throw new Error(`${volume} is already mounted`)
    }

    console.debug(
      `Mounting ${volume}: ${
        typeof handler === 'string' ? `"${handler}"` : typeof handler
      } ${JSON.stringify(sanitizeArgv(argv))}`
    )
    switch (typeof handler) {
      case 'function':
        mounts[volume] = function fn (to: Pid | Channel, from: Process, msg: Message) {
          // process in next "tick", to make it similar to process handler type
          // and break deep/cyclic stack trace
          setTimeout(() => ((handler: any): Handler).call(this, to, from, msg), 0)
        }
        break
      case 'string':
        mounts[volume] = function pr (to: Pid | Channel, from: Process, msg: Message) {
          const proc = this.pid && getProcess(this.pid)
          if (proc) {
            const message: Message = {
              ...msg,
              process: from.pid,
            }
            if (typeof to === 'string') {
              message.path = to
              proc.postMessage(message)
            } else if (typeof to === 'object') {
              message.channel = to.id
              proc.postMessage(message)
            } else {
              from.postMessage(errorReply('EINVAL', msg))
            }
          } else {
            from.postMessage(errorReply('ESRCH', msg))
          }
        }.bind({
          pid: spawn(handler, argv),
          argv,
        })
        break
      default:
        throw new Error('unimplemented')
    }
  }
}

export function unmount (volume: string) {
  if (checkVolumeName(volume)) {
    throw new Error('unimplemented')
  }
}

export function getMounts () {
  throw new Error('unimplemented')
}

export function assign (source: string, dest: string) {
  const sourceParts = splitPath(source.toString())
  const destParts = splitPath(dest.toString())
  if (sourceParts.length === 2 && destParts.length === 2) {
    sourceParts[1] = normalizePath(sourceParts[1])
    destParts[1] = normalizePath(destParts[1])
    source = sourceParts.join(':')
    dest = destParts.join(':')
    console.debug(`Assigning ${source} "${dest}"`)
    assigns[source] = dest
    return true
  }
  return false
}

export function unassign (source: string) {
  console.debug(`Unassigning ${source}`)
  delete assigns[source.toString()]
}

export function getAssigns (): Array<[string, string]> {
  return Object.keys(assigns).map(from => [from, assigns[from]])
}

export function resolvePath (full: string): [?Handler, string] {
  const [volume, path] = splitPath(full)
  return [(checkVolumeName(volume) && mounts[volume]) || undefined, normalizePath(path)]
}

export function splitPath (full: string): [?string, string] {
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

export function normalizePath (path: string) {
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
}

export function resolveAssigns (path: string) {
  const unmatched = Object.assign(Object.create(null), assigns)
  let matched
  do {
    matched = false
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const ass in unmatched) {
      if (path.startsWith(ass)) {
        path = normalizePath([unmatched[ass], normalizePath(path.slice(ass.length))].join('/'))
        delete unmatched[ass]
        matched = true
        break
      }
    }
  } while (matched)
  return path
}

/* eslint-disable no-shadow */
test('normalizePath', (t) => {
  t.test('collapse', (t) => {
    t.equal(normalizePath('foo/bar'), 'foo/bar')
    t.equal(normalizePath('/foo/bar/'), 'foo/bar')
    t.equal(normalizePath('/foo/bar//'), 'foo/bar')
    t.equal(normalizePath('/foo/bar///'), 'foo/bar')
    t.equal(normalizePath('/foo//bar/'), 'foo/bar')
    t.equal(normalizePath('/foo///bar/'), 'foo/bar')
    t.equal(normalizePath('/foo///bar/baz'), 'foo/bar/baz')
    t.equal(normalizePath('/foo/bar//baz/'), 'foo/bar/baz')
    t.end()
  })

  t.test('keep', (t) => {
    t.equal(normalizePath('.'), '')
    t.equal(normalizePath('/foo/.'), 'foo')
    t.equal(normalizePath('foo/./'), 'foo')
    t.equal(normalizePath('/foo/./bar/./baz/'), 'foo/bar/baz')
    t.equal(normalizePath('foo/./././bar'), 'foo/bar')
    t.equal(normalizePath('./././foo/././.'), 'foo')
    t.equal(normalizePath('foo.bar'), 'foo.bar')
    t.equal(normalizePath('/.foo/'), '.foo')
    t.equal(normalizePath('/foo./'), 'foo.')
    t.end()
  })

  t.test('remove', (t) => {
    t.equal(normalizePath('../bar'), 'bar')
    t.equal(normalizePath('/../bar'), 'bar')
    t.equal(normalizePath('bar/..'), '')
    t.equal(normalizePath('/bar/../'), '')
    t.equal(normalizePath('foo/../bar'), 'bar')
    t.equal(normalizePath('foo../../bar../baz'), 'bar../baz')
    t.equal(normalizePath('foo..bar'), 'foo..bar')
    t.equal(normalizePath('/../foo/../bar../..baz/'), 'bar../..baz')
    t.equal(normalizePath('/../../../foo/../bar/../baz'), 'baz')
    t.equal(normalizePath('/foo/bar/../../baz'), 'baz')
    t.equal(normalizePath('/foo/bar/baz/../..'), 'foo')
    t.end()
  })
})

test('splitPath', (t) => {
  t.deepEqual(splitPath('foo:'), ['foo', ''])
  t.deepEqual(splitPath('bar'), [undefined, 'bar'])
  t.deepEqual(splitPath(':bar'), [undefined, 'bar'])
  t.deepEqual(splitPath('::::bar/baz'), [undefined, 'bar/baz'])
  t.deepEqual(splitPath('foo:bar/baz'), ['foo', 'bar/baz'])
  t.deepEqual(splitPath('foo:/bar/baz/'), ['foo', '/bar/baz/'])
  t.deepEqual(splitPath('foo:bar:baz'), ['foo', 'bar:baz'])
  t.deepEqual(splitPath('foo/bar:baz'), [undefined, 'foo/bar:baz'])
  t.end()
})

test('assigns', (t) => {
  t.test('setup', (t) => {
    assign('testcon:foo/..', 'internal:console/../console/')
    assign('testdebugcon:', 'con:debug/restricted')
    t.end()
  })

  t.test('getAssigns', (t) => {
    const assigns = getAssigns()
    t.deepEqual(assigns.find(a => a[0] === 'testcon:'), ['testcon:', 'internal:console'])
    t.deepEqual(assigns.find(a => a[0] === 'testdebugcon:'), [
      'testdebugcon:',
      'con:debug/restricted',
    ])
    t.end()
  })

  t.test('resolveAssigns', (t) => {
    t.equal(resolveAssigns('testcon:debug'), 'internal:console/debug')
    t.equal(resolveAssigns('testdebugcon:../unsafe'), 'internal:console/debug/restricted/unsafe')
    t.end()
  })

  t.test('teardown', (t) => {
    unassign('testcon:')
    unassign('testdebugcon:')
    t.end()
  })
})
