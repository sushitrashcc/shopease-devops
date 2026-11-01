'use strict';
process.env.API_KEY = 'unit-test-key-not-a-secret';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

let server;
let base;
const auth = { 'x-api-key': process.env.API_KEY, 'Content-Type': 'application/json' };
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => new Promise((r) => server.close(r)));

test('health is public', async () => {
  assert.strictEqual((await fetch(`${base}/health`)).status, 200);
});

test('patients endpoint rejects missing API key', async () => {
  assert.strictEqual((await fetch(`${base}/api/patients`)).status, 401);
});

test('patients endpoint rejects wrong API key', async () => {
  assert.strictEqual((await fetch(`${base}/api/patients`, { headers: { 'x-api-key': 'wrong' } })).status, 401);
});

test('PII is masked in responses', async () => {
  const list = await (await fetch(`${base}/api/patients`, { headers: auth })).json();
  assert.ok(list.length >= 3);
  for (const p of list) {
    assert.match(p.phone, /^X{6}\d{4}$/);
    assert.match(p.aadhaar, /^X{8}\d{4}$/);
  }
});

test('security headers are present', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('content-security-policy'));
  assert.strictEqual(res.headers.get('x-powered-by'), null);
});

test('invalid patient payload is rejected', async () => {
  const res = await fetch(`${base}/api/patients`, { method: 'POST', headers: auth, body: JSON.stringify({ name: '<script>', age: 500 }) });
  assert.strictEqual(res.status, 400);
});

test('valid patient is created with masked PII', async () => {
  const body = { name: 'Meera Iyer', age: 45, gender: 'F', bloodGroup: 'AB+', phone: '9812345678', aadhaar: '111122223333' };
  const res = await fetch(`${base}/api/patients`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).aadhaar, 'XXXXXXXX3333');
});
