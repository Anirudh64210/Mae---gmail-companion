import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, memoryLimiter, LIMITS } from '../../relay/index.mjs';
import { stub } from '../../relay/providers/stub.mjs';

const S = ['Can you send the contract?', 'What is your day rate?'];
const good = { sentences: S, draft: 'Contract attached.' };

function post(body, headers = {}, origin = 'chrome-extension://abc') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://relay/check', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'content-length': String(text.length), ...headers }, body: text });
}

test('returns numbers only for a valid request', async () => {
  const h = createHandler({ provider: stub });
  const r = await h.handle(post(good));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(Object.keys(j).sort(), ['ans', 'ask']);
  assert.equal(j.ask.length, 2);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('rejects other origins when a list is set, and answers preflight', async () => {
  const h = createHandler({ provider: stub, allowedOrigins: ['chrome-extension://abc'] });
  assert.equal((await h.handle(post(good, {}, 'https://evil.example'))).status, 403);
  assert.equal((await h.handle(post(good))).status, 200);
  const pre = await h.handle(new Request('http://relay/check', { method: 'OPTIONS', headers: { origin: 'chrome-extension://abc' } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'chrome-extension://abc');
});

test('rejects bad methods, bad json, bad shapes and oversize bodies', async () => {
  const h = createHandler({ provider: stub });
  assert.equal((await h.handle(new Request('http://relay/check', { method: 'GET' }))).status, 405);
  assert.equal((await h.handle(post('{nope'))).status, 400);
  assert.equal((await h.handle(post({ sentences: 'x', draft: 'y' }))).status, 400);
  assert.equal((await h.handle(post({ sentences: [], draft: 'y' }))).status, 400);
  assert.equal((await h.handle(post({ sentences: Array(21).fill('a?'), draft: 'y' }))).status, 400);
  assert.equal((await h.handle(post({ sentences: ['a'.repeat(601)], draft: 'y' }))).status, 400);
  assert.equal((await h.handle(post(good, { 'content-length': String(LIMITS.bodyBytes + 1) }))).status, 413);
});

test('rate limits per install and per day', async () => {
  const h = createHandler({ provider: stub, limits: { perInstallPerHour: 2, perDay: 3 } });
  const a = { 'x-dyaa-install': 'a' }, b = { 'x-dyaa-install': 'b' };
  assert.equal((await h.handle(post(good, a))).status, 200);
  assert.equal((await h.handle(post(good, a))).status, 200);
  assert.equal((await h.handle(post(good, a))).status, 429);   // install a over its hourly limit
  assert.equal((await h.handle(post(good, b))).status, 200);   // third of the day
  assert.equal((await h.handle(post(good, b))).status, 429);   // daily cap
});

test('limiter resets by hour and day', () => {
  const l = memoryLimiter();
  const lim = { perInstallPerHour: 1, perDay: 10 };
  assert.equal(l.allow('a', lim, 0), true);
  assert.equal(l.allow('a', lim, 0), false);
  assert.equal(l.allow('a', lim, 3600000), true);
});

test('provider errors, timeouts and bad results fail closed with no text', async () => {
  const boom = createHandler({ provider: { check: () => Promise.reject(new Error('secret text')) } });
  const r1 = await boom.handle(post(good));
  assert.equal(r1.status, 502);
  assert.equal(await r1.text(), '{"error":"provider"}');
  const slow = createHandler({ provider: { check: () => new Promise(() => {}) }, limits: { providerTimeoutMs: 20 } });
  assert.equal((await slow.handle(post(good))).status, 502);
  const bad = createHandler({ provider: { check: async () => ({ ask: [2, 0], ans: [0, 0] }) } });
  assert.equal((await bad.handle(post(good))).status, 502);
});
