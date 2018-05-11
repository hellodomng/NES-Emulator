const path = require('path')
const webpack = require('webpack')

const argv = process.argv

console.log(argv)

module.exports = {
  entry: './test/main.js',
  output: {
    path: path.resolve(__dirname, 'test'),
    filename: 'test-bundle.js'
  },
  resolve: {
    alias: {
      'test': path.resolve(__dirname, 'test'),
      'src': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  }
}
