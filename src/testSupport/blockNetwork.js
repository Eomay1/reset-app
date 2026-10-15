// Jest-only safety net, also loaded by the Netlify function test command.
// Individual tests may replace these with mocks, never real service clients.
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

function blocked() {
  throw new Error('Network disabled in RESET tests. Use a mock service.');
}

beforeEach(() => {
  jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(blocked);
  for (const client of [http, https]) {
    jest.spyOn(client, 'request').mockImplementation(blocked);
    jest.spyOn(client, 'get').mockImplementation(blocked);
  }
  global.fetch = jest.fn(() => Promise.reject(new Error('Network disabled in RESET tests. Use a mock service.')));
  if (typeof XMLHttpRequest !== 'undefined') jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(blocked);
  if (typeof WebSocket !== 'undefined') global.WebSocket = jest.fn(blocked);
});
