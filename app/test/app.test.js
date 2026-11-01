'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

let server;
let base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => new Promise((r) => server.close(r)));

test('health endpoint returns UP', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'UP' });
});

test('lists six products', async () => {
  const body = await (await fetch(`${base}/api/products`)).json();
  assert.strictEqual(body.length, 6);
});

test('filters products by category', async () => {
  const body = await (await fetch(`${base}/api/products?category=fashion`)).json();
  assert.ok(body.length > 0 && body.every((p) => p.category === 'Fashion'));
});

test('unknown product returns 404', async () => {
  assert.strictEqual((await fetch(`${base}/api/products/999`)).status, 404);
});

test('adds item to cart and computes total', async () => {
  const h = { 'Content-Type': 'application/json', 'x-cart-id': 'test' };
  const res = await fetch(`${base}/api/cart`, { method: 'POST', headers: h, body: JSON.stringify({ productId: 4, qty: 2 }) });
  assert.strictEqual(res.status, 201);
  const cart = await res.json();
  assert.strictEqual(cart.total, 1198);
});

test('rejects invalid quantity', async () => {
  const h = { 'Content-Type': 'application/json', 'x-cart-id': 'test2' };
  const res = await fetch(`${base}/api/cart`, { method: 'POST', headers: h, body: JSON.stringify({ productId: 1, qty: 50 }) });
  assert.strictEqual(res.status, 400);
});
