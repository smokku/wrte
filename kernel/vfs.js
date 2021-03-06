// @flow
import test from '../test/tape'

import type { Message, Channel } from './ipc'
import type { Process } from './proc'

import {
  spawn, getProcessForWindow, getProcess, sanitizeArgv,
} from './proc'
import { errorReply, makeReply, notifyNewChannel } from './ipc'
import { VOLUME_NAME_REGEXP, MAX_ASSIGN_RESOLVE_ATTEMPTS } from './tunables'

import { init as consoleInit, handler as consoleHandler } from './internal/console'
import { init as windowInit, handler as windowHandler } from './internal/window'

import webdavWorker from './vfs/webdav.worker'

export type Path = string
export type Volume = string

const mounts: Map<Volume, Handler> = new Map()
const assigns: Map<Path, Path> = new Map()

const internal = {
  console: [consoleHandler],
  window: [windowHandler],
  webdav: [contentHandler, webdavWorker],
}
const inits = [consoleInit, windowInit]
const initialMounts = {
  http: ['internal:webdav', ['with-host']],
  https: ['internal:webdav', ['with-host', 'secure']],
}

/**
 * Handler function
 * @arg to - _Path_ or _Channel_ the _message_ belongs to.
 * @arg from - _Process_ sending the _message_.
 * @arg msg - _Message_ object.
 */
export type Handler = (to: Path | Channel, from: Process, msg: Message) => void

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
function internalHandler (to: Path | Channel, from: Process, msg: Message): void {
  const fullPath = typeof to === 'object' ? to.path : to
  // console.debug('[internal:]', fullPath, from.pid, msg)
  if (typeof fullPath === 'string') {
    const parts = fullPath.split('/')
    const int = parts.shift()
    const [handler, ...argv] = (int && internal[int]) || []

    if (typeof handler === 'function') {
      const path = parts.join('/')
      handler.call({ argv, path }, to, from, msg)
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
export function contentHandler (to: Path | Channel, from: Process, msg: Message): void {
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

  window.addEventListener('message', messageHandler)
}

/**
 * VFS window message receiver.
 * @param evt - WindowMessage event.
 */
function messageHandler (evt) {
  if (
    evt.isTrusted &&
    evt.origin === 'null' &&
    typeof evt.data === 'object' &&
    typeof evt.data.path === 'string' &&
    evt.data.process == null &&
    evt.data.channel == null
  ) {
    // console.debug('VFS', evt)
    const { source, data } = evt
    const from = getProcessForWindow(source)
    const [handler, path] = resolvePath(resolveAssigns(data.path))

    if (from) {
      if (typeof handler !== 'function') {
        from.postMessage(errorReply('ENODEV', data))
      } else {
        if (data.type === 'OPEN') {
          const channel = from.openChannel()
          channel.handler = handler
          channel.path = path
          channel.send = function send (msg: Message) {
            global.console.warn('>>>>>>>>>>', msg) // FIXME: implement!
          }
          notifyNewChannel(from, channel.id, { path: data.path }, data)
          handler(channel, from, { ...data, path })
          return
        }
        // CLOSE is being handled in VFS, as it is delivered to this ^^^ _Channel_

        handler(path, from, data)
      }
    }
  }
}

/**
 * Checks if volume name is valid.
 *
 * @param volume - _Volume_ name.
 * @returns Boolean.
 */
function checkVolumeName (volume: ?Volume): boolean %checks {
  return typeof volume === 'string' && !!volume.match(new RegExp(`^${VOLUME_NAME_REGEXP}$`))
}

/**
 * Mounts a _Process_ or `internal:` handler on _VFS_ volume.
 *
 * _VFS_ volume can be handled either by spawning a dedicated process
 * processing messages sent to _VFS_ paths or by handler function
 * provided internally ba kernel.
 *
 * @param volume - _Volume_ name.
 * @param handler - _Path_ to process content or handler function.
 * @param argv - Array of arguments.
 */
export function mount (volume: Volume, handler: Path | Handler, argv: Array<mixed> = []) {
  if (checkVolumeName(volume)) {
    if (mounts.has(volume)) {
      throw new Error(`${volume} is already mounted`)
    }

    window.console.debug(
      `Mounting ${volume}: ${
        typeof handler === 'string' ? `"${handler}"` : typeof handler
      } ${JSON.stringify(sanitizeArgv(argv))}`
    )
    switch (typeof handler) {
      case 'function':
        mounts.set(volume, function fn (to: Path | Channel, from: Process, msg: Message) {
          // process in next "tick", to make it similar to process handler type
          // and break deep/cyclic stack trace
          setTimeout(() => ((handler: any): Handler).call(this, to, from, msg), 0)
        })
        break
      case 'string':
        mounts.set(
          volume,
          function prc (to: Path | Channel, from: Process, msg: Message) {
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
                if (msg.type === 'OPEN' && typeof to.path === 'string' && to.path) {
                  // FIXME: Refactor following to connectChannels() function used in IPC too.
                  const chId = to.id
                  const chPath = to.path
                  const chan = proc.openChannel()
                  chan.pid = from.pid
                  chan.endpoint = chId
                  to.pid = proc.pid
                  to.endpoint = chan.id
                  notifyNewChannel(proc, chan.id, { process: from.pid, path: chPath }, msg)
                  // eslint-disable-next-line max-len
                  chan.onTerminate = () => notifyNewChannel(from, chId, { process: null }, msg)
                  return
                }

                message.channel = to.endpoint
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
        )
        break
      default:
        throw new Error('unimplemented')
    }
  }
}

/**
 * Unmounts _Volume handler.
 *
 * @param volume - _Volume_ name.
 */
export function unmount (volume: Volume) {
  if (checkVolumeName(volume)) {
    throw new Error('unimplemented')
  }
}

/**
 * List all mounts and handlers.
 */
export function getMounts () {
  throw new Error('unimplemented')
}

/**
 * Create a mapping from one _Path_ to another _Path_.
 *
 * _VFS_ will replace source part of _Path_ with dest, every time
 * it resolves a _Path_ - keeping the part that does not match.
 * This allows mapping a part of _VFS_ tree under other _Path_,
 * including shadowing already existing _VFS_ trees.
 *
 * @param source - Part of _Path_ to be replaced.
 * @param dest - _Path_ replacement.
 * @returns - Success boolean.
 */
export function assign (source: Path, dest: Path): boolean {
  const sourceParts = splitPath(source.toString())
  const destParts = splitPath(dest.toString())
  if (sourceParts.length === 2 && destParts.length === 2) {
    sourceParts[1] = normalizePath(sourceParts[1])
    destParts[1] = normalizePath(destParts[1])
    source = sourceParts.join(':')
    dest = destParts.join(':')
    window.console.debug(`Assigning ${source} "${dest}"`)
    assigns.set(source, dest)
    return true
  }
  return false
}

/**
 * Removes an assign.
 *
 * @param source - _Assign_ source part of _Path_.
 */
export function unassign (source: Path) {
  window.console.debug(`Unassigning ${source}`)
  assigns.delete(source)
}

/**
 * List all _Assign_s.
 *
 * @returns Array of [source, dest] _Path_ parts.
 */
export function getAssigns (): Array<[Path, Path]> {
  return [...assigns.entries()]
}

/**
 * Map a _Path_ to its _Handler_.
 * @param full - _Path_ string.
 * @returns Array of [_Handler_, normalized_Path_].
 */
export function resolvePath (full: Path): [?Handler, Path] {
  const [volume, path] = splitPath(full)
  return [(checkVolumeName(volume) && mounts.get(volume)) || undefined, normalizePath(path)]
}

/**
 * Split _Path_ to _Volume_ part and rest.
 *
 * @param full - _Path_ to split.
 * @returns Array of [Volume, rest] parts.
 */
export function splitPath (full: Path): [?Volume, Path] {
  const match = full.match(new RegExp(`^${VOLUME_NAME_REGEXP}:`))
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

/**
 * Normalizes a _Path_ removing repeating directory separators,
 * resolving `.` and `..` references, and leading and trailing separators.
 *
 * @param path - _Path_ to normalize.
 * @returns Resolved _Path_.
 */
export function normalizePath (path: Path) {
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

/**
 * Pass _Path_ over _Assign_s mapping resolving all _Assign_s.
 * Possibly multiple times (until reaching MAX_ASSIGN_RESOLVE_ATTEMPTS).
 *
 * @param path - _Path_ to resolve.
 * @returns Resolved and normalized _Path_.
 */
export function resolveAssigns (path: Path): Path {
  const unmatched = new Map(assigns)
  let attempts = 0
  let matched
  do {
    matched = false
    attempts += 1
    if (attempts > MAX_ASSIGN_RESOLVE_ATTEMPTS) {
      throw new Error(
        `Maximum resolveAssign resolution attempts (${MAX_ASSIGN_RESOLVE_ATTEMPTS}) reached.`
      )
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const [from, dest] of unmatched.entries()) {
      if (path.startsWith(from)) {
        path = normalizePath([dest, normalizePath(path.slice(from.length))].join('/'))
        unmatched.delete(from)
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
    t.equal(normalizePath('/.../foo/'), '.../foo')
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
