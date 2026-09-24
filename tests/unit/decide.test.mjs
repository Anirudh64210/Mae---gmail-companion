import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decide } = require('../../extension/content/decide.js');

const S = ['Great call yesterday.', 'Can you send the contract?', 'What is your day rate?', 'Could we move kickoff?'];

test('flags questions that were asked and not answered', () => {
  const r = decide(S, [0.1, 0.95, 0.9, 0.99], [0.5, 0.9, 0.05, 0.8]);
  assert.equal(r.total, 3);
  assert.deepEqual(r.missed, ['What is your day rate?']);
  assert.deepEqual(r.missedIdx, [2]);
});

test('thresholds are inclusive at the edges', () => {
  const r = decide(['a', 'b'], [0.85, 0.849], [0.20, 0.0]);
  assert.equal(r.total, 1);
  assert.deepEqual(r.missed, ['a']);
});

test('uncertain answers are not flagged', () => {
  assert.equal(decide(['a'], [0.99], [0.21]).missed.length, 0);
});

test('no questions means total 0', () => {
  assert.deepEqual(decide(S, [0, 0, 0, 0], [0, 0, 0, 0]), { total: 0, missed: [], missedIdx: [] });
});

test('missing or malformed numbers never flag', () => {
  const r = decide(S, [0.99], [NaN, 0.1]);
  assert.equal(r.total, 1);
  assert.equal(r.missed.length, 0);
});
