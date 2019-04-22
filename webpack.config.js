var path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'middlemam.lib.js',
    libraryTarget: 'umd',
    library: 'MiddleMAM'
  },
  node: {
    fs: 'empty'
  }
};
