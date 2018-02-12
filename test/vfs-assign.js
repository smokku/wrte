import test from 'ava'

import { assign, unassign, getAssigns, resolveAssigns } from '../kernel/vfs'

test.before((t) => {
  assign('con:foo/..', 'internal:console/../console/')
  assign('debugcon:', 'con:debug/restricted')
})

test('getAssigns', (t) => {
  t.deepEqual(getAssigns(), [['con:', 'internal:console'], ['debugcon:', 'con:debug/restricted']])
})

test('resolveAssigns', (t) => {
  t.is(resolveAssigns('con:debug'), 'internal:console/debug')
  t.is(resolveAssigns('debugcon:../unsafe'), 'internal:console/debug/restricted/unsafe')
})

test.after((t) => {
  unassign('con:')
  unassign('debugcon:')
})
