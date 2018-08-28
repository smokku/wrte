// @flow
// $FlowFixMe - have no idea why this import is unresolved?!
import test from '../node_modules/tape-rollup/tape'

export default (window.tapExtension ? window.tapExtension(test) : test)
