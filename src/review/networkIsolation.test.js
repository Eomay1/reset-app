const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

test('safety net blocks unmocked network access before any connection', async () => {
  await expect(fetch('https://never-contact.invalid')).rejects.toThrow('Network disabled');
  expect(() => http.get('http://never-contact.invalid')).toThrow('Network disabled');
  expect(() => https.request('https://never-contact.invalid')).toThrow('Network disabled');
  expect(() => new net.Socket().connect(443, 'never-contact.invalid')).toThrow('Network disabled');
  expect(() => new XMLHttpRequest().open('POST', 'https://never-contact.invalid')).toThrow('Network disabled');
  expect(() => new WebSocket('wss://never-contact.invalid')).toThrow('Network disabled');
});
