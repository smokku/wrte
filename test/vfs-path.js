import test from 'ava'

import { normalizePath, splitPath } from '../kernel/vfs'

test('normalizePath - collapse', (t) => {
  t.is(normalizePath('foo/bar'), 'foo/bar')
  t.is(normalizePath('/foo/bar/'), 'foo/bar')
  t.is(normalizePath('/foo/bar//'), 'foo/bar')
  t.is(normalizePath('/foo/bar///'), 'foo/bar')
  t.is(normalizePath('/foo//bar/'), 'foo/bar')
  t.is(normalizePath('/foo///bar/'), 'foo/bar')
  t.is(normalizePath('/foo///bar/baz'), 'foo/bar/baz')
  t.is(normalizePath('/foo/bar//baz/'), 'foo/bar/baz')
})

test('normalizePath - keep', (t) => {
  t.is(normalizePath('.'), '')
  t.is(normalizePath('/foo/.'), 'foo')
  t.is(normalizePath('foo/./'), 'foo')
  t.is(normalizePath('/foo/./bar/./baz/'), 'foo/bar/baz')
  t.is(normalizePath('foo/./././bar'), 'foo/bar')
  t.is(normalizePath('./././foo/././.'), 'foo')
  t.is(normalizePath('foo.bar'), 'foo.bar')
  t.is(normalizePath('/.foo/'), '.foo')
  t.is(normalizePath('/foo./'), 'foo.')
})

test('normalizePath - remove', (t) => {
  t.is(normalizePath('../bar'), 'bar')
  t.is(normalizePath('/../bar'), 'bar')
  t.is(normalizePath('bar/..'), '')
  t.is(normalizePath('/bar/../'), '')
  t.is(normalizePath('foo/../bar'), 'bar')
  t.is(normalizePath('foo../../bar../baz'), 'bar../baz')
  t.is(normalizePath('foo..bar'), 'foo..bar')
  t.is(normalizePath('/../foo/../bar../..baz/'), 'bar../..baz')
  t.is(normalizePath('/../../../foo/../bar/../baz'), 'baz')
  t.is(normalizePath('/foo/bar/../../baz'), 'baz')
  t.is(normalizePath('/foo/bar/baz/../..'), 'foo')
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
})
