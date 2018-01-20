const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: {
    kernel: './kernel/index.js',
    'cmd/logger': './cmd/logger.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist', 'current'),
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    publicPath: '/current/',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  plugins: [
    new webpack.EnvironmentPlugin(['npm_package_name', 'npm_package_version', 'git_build_sha']),
  ],
}
