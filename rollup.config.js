import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'
import git from 'git-rev-sync'

import pkg from './package.json'

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH && process.env.NODE_ENV !== 'test'

const babelConfig = {
  exclude: 'node_modules/**',
}
if (production) {
  babelConfig.plugins = [
    ['discard-module-references', { targets: ['./test/tape', '../test/tape', '../../test/tape'] }],
  ]
}

const baseConfig = {
  output: {
    format: 'iife', // immediately-invoked function expression — suitable for <script> tags
    sourcemap: !production,
    interop: false,
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.npm_package_name': JSON.stringify(pkg.name),
      'process.env.npm_package_version': JSON.stringify(pkg.version),
      'process.env.git_build_sha': JSON.stringify(production ? git.short() : 'dev'),
      global: 'self',
    }),
    babel(babelConfig),
  ],
}

const entries = {
  'kernel/index.js': {
    file: 'dist/current/kernel.js',
    name: 'wrte',
  },
  'cmd/logger.js': 'dist/current/cmd/logger.js',
  'cmd/rc.js': 'dist/current/cmd/rc.js',
  // "cmd/cat.js": "dist/current/cmd/cat.js",
}
if (!production) {
  entries['test/channel.js'] = 'dist/current/test/channel.js'
  entries['test/window.js'] = 'dist/current/test/window.js'
  entries['test/file.js'] = 'dist/current/test/file.js'
}

export default Object.entries(entries).reduce(
  (configs, [path, entry]) => configs.concat(
    Object.assign({}, baseConfig, {
      input: path,
      output: Object.assign(
        {},
        baseConfig.output,
        typeof entry === 'object' ? entry : { file: entry }
      ),
    })
  ),
  []
)
