import test from '../node_modules/tape-rollup/tape'

export default (window.tapExtension ? window.tapExtension(test) : test)
