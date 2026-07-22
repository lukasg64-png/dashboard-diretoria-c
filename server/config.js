const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  port: process.env.PORT || 8092,
  vtex: {
    account: process.env.VTEX_ACCOUNT || 'sjdigital',
    appKey: process.env.VTEX_APP_KEY || 'vtexappkey-sjdigital-NBIBYX',
    appToken: process.env.VTEX_APP_TOKEN || 'ZWWMCOPAPYMWRDDFJXJASHHUYAHMNWFDLQKYEFYTGNOHDWBDBJGDWDRAQKGALTKTJZUTNMSEOSARVFCIQDNTEVGACYJBFYYKDFRYJTFSQJTOANANWPYYWISDULGXVMON'
  },
  paths: {
    dataDir: path.join(__dirname, '../data'),
    cacheFile: path.join(__dirname, '../data/vtex_cancellations_cache.json')
  }
};
