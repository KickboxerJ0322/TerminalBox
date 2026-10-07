import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fetchPublicPage } from '../src/mock-site-fetch.js';

function transport(pages, calls) {
  return (url, options, callback) => {
    calls.push(url.href);
    options.lookup(url.hostname, { all: true }, (error, addresses) => {
      assert.equal(error, null);
      assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
    });
    options.lookup(url.hostname, {}, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
    });
    const request = new EventEmitter();
    request.destroy = error => { if (error) request.emit('error', error); request.emit('close'); };
    queueMicrotask(() => {
      const page = pages[url.hostname];
      const response = new EventEmitter();
      response.statusCode = page.status ?? 200;
      response.headers = { 'content-type': 'text/html', ...page.headers };
      response.destroy = () => {};
      callback(response);
      if (response.statusCode === 200) { response.emit('data', Buffer.from('<title>Shop</title><p>Products</p>')); response.emit('end'); }
      request.emit('close');
    });
    return request;
  };
}
const dual = async () => [{ address: '2606:4700::1111', family: 6 }, { address: '8.8.8.8', family: 4 }];
test('dual stack uses pinned public IPv4 and accepts HTML', async () => {
  const calls = [];
  const result = await fetchPublicPage('https://shop.example/', { resolve: dual, get: transport({ 'shop.example': {} }, calls) });
  assert.equal(result.title, 'Shop'); assert.equal(calls.length, 1);
});
test('redirects resolve and validate each destination before connecting', async () => {
  const calls = []; const resolved = [];
  const result = await fetchPublicPage('https://shop.example/', {
    resolve: async name => { resolved.push(name); return dual(); },
    get: transport({ 'shop.example': { status: 302, headers: { location: 'https://final.example/' } }, 'final.example': {} }, calls),
  });
  assert.equal(result.url, 'https://final.example/'); assert.deepEqual(resolved, ['shop.example', 'final.example']);
  const blockedCalls = [];
  await assert.rejects(fetchPublicPage('https://shop.example/', {
    resolve: async name => name === 'shop.example' ? dual() : [{ address: '169.254.169.254', family: 4 }],
    get: transport({ 'shop.example': { status: 302, headers: { location: 'https://internal.example/' } } }, blockedCalls),
  }), /内部・予約済み/);
  assert.equal(blockedCalls.length, 1);
});
test('private mixed DNS, IPv6 only and HTTPS downgrade are rejected', async () => {
  for (const addresses of [[{ address: '::1' }], [{ address: '8.8.8.8' }, { address: '10.0.0.1' }]]) {
    await assert.rejects(fetchPublicPage('https://shop.example/', { resolve: async () => addresses, get: () => assert.fail('must not connect') }));
  }
  await assert.rejects(fetchPublicPage('https://shop.example/', { resolve: dual, get: transport({ 'shop.example': { status: 302, headers: { location: 'http://final.example/' } } }, []) }), /公開HTTPS/);
});
test('redirect loops stop after three redirects', async () => {
  const calls = [];
  await assert.rejects(fetchPublicPage('https://shop.example/', { resolve: dual, get: transport({ 'shop.example': { status: 302, headers: { location: '/' } } }, calls) }), /転送回数/);
  assert.equal(calls.length, 4);
});
