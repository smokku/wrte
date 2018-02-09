import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'
import git from 'git-rev-sync'

import pkg from './package.json'

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH

const baseConfig = {
  output: {
    format: 'iife', // immediately-invoked function expression — suitable for <script> tags
    sourcemap: !production,
  },
  plugins: [
    replace({
      'process.env.npm_package_name': JSON.stringify(pkg.name),
      'process.env.npm_package_version': JSON.stringify(pkg.version),
      'process.env.git_build_sha': JSON.stringify(production ? git.short() : 'dev'),
      global: 'self',
    }),
    babel(),
  ],
}

const entries = {
  'kernel/index.js': {
    file: 'dist/current/kernel.js',
    name: 'wrte',
  },
  'cmd/logger.js': 'dist/current/cmd/logger.js',
  'cmd/rc.js': 'dist/current/cmd/rc.js',
  'cmd/cat.js': 'dist/current/cmd/cat.js',
}

export default Object.keys(entries).reduce(
  (configs, entry) =>
    configs.concat(Object.assign({}, baseConfig, {
      input: entry,
      output: Object.assign(
        {},
        baseConfig.output,
        typeof entries[entry] === 'object' ? entries[entry] : { file: entries[entry] }
      ),
    })),
  []
)
