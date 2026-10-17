import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { publicAddress, storeURL, approvedAddresses, wooRequest } from '../lib/woo-http.ts';

test('Store URLs accept public domains and WordPress subdirectories without an allowlist', () => {
  assert.equal(storeURL('https://shop.client.com/wordpress/?x=1#top'), 'https://shop.client.com/wordpress');
  for (const url of ['http://shop.client.com', 'https://localhost', 'https://foo.local', 'https://127.1',
    'https://2130706433', 'https://[::1]', 'https://user:pass@shop.client.com', 'https://shop.client.com:8443']) {
    assert.throws(() => storeURL(url), undefined, url);
  }
});

test('Private, reserved, mapped, and transition IP addresses are blocked', () => {
  for (const ip of ['0.0.0.0', '10.1.1.1', '100.100.100.200', '127.0.0.1', '169.254.169.254',
    '172.16.1.1', '192.168.1.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::a00:1',
    '2001::1', '2001:db8::1', '2002:7f00:1::', '3fff::1']) assert.equal(publicAddress(ip), false, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(publicAddress(ip), true, ip);
  assert.throws(() => approvedAddresses([]));
  assert.throws(() => approvedAddresses([{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]));
});

test('Transport pins approved DNS, preserves hostname, and rejects redirects without following them', async () => {
  let dnsCalls = 0, connections = 0, status = 200;
  const dnsMock = mock.method(dns, 'lookup', async () => { dnsCalls++; return [{address:'8.8.8.8',family:4}]; });
  const requestMock = mock.method(https, 'request', (url, options, callback) => {
    connections++;
    assert.equal(url.hostname, 'shop.client.com');
    assert.equal(url.pathname, '/wordpress/wp-json/wc/v3/products');
    assert.equal(options.agent, false);
    options.lookup(url.hostname, {}, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
    });
    options.lookup(url.hostname, {all:true}, (error, addresses) => {
      assert.equal(error, null); assert.deepEqual(addresses, [{address:'8.8.8.8',family:4}]);
    });
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => {
      const res = new EventEmitter(); res.statusCode = status; res.resume = () => {};
      callback(res);
      if (status === 200) { res.emit('data', Buffer.from('[{"id":1}]')); res.emit('end'); }
    });
    return req;
  });
  syncBuiltinESMExports();
  try {
    assert.deepEqual(await wooRequest('https://shop.client.com/wordpress', 'products', 'Basic test'), [{id:1}]);
    status = 302;
    await assert.rejects(wooRequest('https://shop.client.com/wordpress', 'products', 'Basic test'), /redirected/);
    assert.equal(dnsCalls, 2); assert.equal(connections, 2);
    dnsMock.mock.mockImplementation(async () => [{address:'127.0.0.1',family:4}]);
    await assert.rejects(wooRequest('https://shop.client.com', 'products', 'Basic test'), /public internet/);
    assert.equal(connections, 2);
  } finally { dnsMock.mock.restore(); requestMock.mock.restore(); syncBuiltinESMExports(); }
});
