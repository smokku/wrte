import {
  normalizePath,
  splitPath,
  assign,
  unassign,
  getAssigns,
  resolveAssigns,
} from '../kernel/vfs'

describe('normalizePath', () => {
  test('collapse', () => {
    expect(normalizePath('foo/bar')).toBe('foo/bar')
    expect(normalizePath('/foo/bar/')).toBe('foo/bar')
    expect(normalizePath('/foo/bar//')).toBe('foo/bar')
    expect(normalizePath('/foo/bar///')).toBe('foo/bar')
    expect(normalizePath('/foo//bar/')).toBe('foo/bar')
    expect(normalizePath('/foo///bar/')).toBe('foo/bar')
    expect(normalizePath('/foo///bar/baz')).toBe('foo/bar/baz')
    expect(normalizePath('/foo/bar//baz/')).toBe('foo/bar/baz')
  })

  test('keep', () => {
    expect(normalizePath('.')).toBe('')
    expect(normalizePath('/foo/.')).toBe('foo')
    expect(normalizePath('foo/./')).toBe('foo')
    expect(normalizePath('/foo/./bar/./baz/')).toBe('foo/bar/baz')
    expect(normalizePath('foo/./././bar')).toBe('foo/bar')
    expect(normalizePath('./././foo/././.')).toBe('foo')
    expect(normalizePath('foo.bar')).toBe('foo.bar')
    expect(normalizePath('/.foo/')).toBe('.foo')
    expect(normalizePath('/foo./')).toBe('foo.')
  })

  test('remove', () => {
    expect(normalizePath('../bar')).toBe('bar')
    expect(normalizePath('/../bar')).toBe('bar')
    expect(normalizePath('bar/..')).toBe('')
    expect(normalizePath('/bar/../')).toBe('')
    expect(normalizePath('foo/../bar')).toBe('bar')
    expect(normalizePath('foo../../bar../baz')).toBe('bar../baz')
    expect(normalizePath('foo..bar')).toBe('foo..bar')
    expect(normalizePath('/../foo/../bar../..baz/')).toBe('bar../..baz')
    expect(normalizePath('/../../../foo/../bar/../baz')).toBe('baz')
    expect(normalizePath('/foo/bar/../../baz')).toBe('baz')
    expect(normalizePath('/foo/bar/baz/../..')).toBe('foo')
  })
})

test('splitPath', () => {
  expect(splitPath('foo:')).toEqual(['foo', ''])
  expect(splitPath('bar')).toEqual([undefined, 'bar'])
  expect(splitPath(':bar')).toEqual([undefined, 'bar'])
  expect(splitPath('::::bar/baz')).toEqual([undefined, 'bar/baz'])
  expect(splitPath('foo:bar/baz')).toEqual(['foo', 'bar/baz'])
  expect(splitPath('foo:/bar/baz/')).toEqual(['foo', '/bar/baz/'])
  expect(splitPath('foo:bar:baz')).toEqual(['foo', 'bar:baz'])
  expect(splitPath('foo/bar:baz')).toEqual([undefined, 'foo/bar:baz'])
})

describe('assigns', () => {
  beforeAll(() => {
    assign('con:foo/..', 'internal:console/../console/')
    assign('debugcon:', 'con:debug/restricted')
  })
  afterAll(() => {
    unassign('con:')
    unassign('debugcon:')
  })

  test('getAssigns', () => {
    expect(getAssigns()).toEqual([
      ['con:', 'internal:console'],
      ['debugcon:', 'con:debug/restricted'],
    ])
  })

  test('resolveAssigns', () => {
    expect(resolveAssigns('con:debug')).toBe('internal:console/debug')
    expect(resolveAssigns('debugcon:../unsafe')).toBe('internal:console/debug/restricted/unsafe')
  })
})
