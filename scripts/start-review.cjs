const path = require('node:path');
const { createReviewEnvironment } = require('./reviewEnvironment.cjs');

Object.assign(process.env, createReviewEnvironment(process.env, path.resolve(__dirname, '..')));
const { REVIEW_CSP } = require('../src/review/networkPolicy');
const configPath = require.resolve('react-scripts/config/webpackDevServer.config');
const createConfig = require(configPath);
require.cache[configPath].exports = (...args) => {
  const config = createConfig(...args);
  return {
    ...config,
    // No backend proxies or Netlify function emulation in the review server.
    proxy: [],
    headers: { ...config.headers, 'Content-Security-Policy': REVIEW_CSP }
  };
};
console.log('RESET isolated review: mock services, prefixed browser storage, API connections blocked.');
require('react-scripts/scripts/start');
