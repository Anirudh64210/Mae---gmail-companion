import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validate } = require('../../extension/content/decide.js');
const { splitSentences, MAX_CHARS } = require('../../extension/content/extract.js');

test('accepts a well-formed response', () => {
  assert.equal(validate({ ask: [0.9, 0.1], ans: [0.2, 0.8] }, 2), true);
  assert.equal(validate({ ask: [0, 1], ans: [1, 0] }, 2), true);
});

test('rejects wrong shapes and values', () => {
  assert.equal(validate(null, 2), false);
  assert.equal(validate('ok', 2), false);
  assert.equal(validate({ ask: [0.9], ans: [0.2, 0.8] }, 2), false);
  assert.equal(validate({ ask: [0.9, 0.1] }, 2), false);
  assert.equal(validate({ ask: [0.9, '0.1'], ans: [0.2, 0.8] }, 2), false);
  assert.equal(validate({ ask: [0.9, NaN], ans: [0.2, 0.8] }, 2), false);
  assert.equal(validate({ ask: [0.9, 1.5], ans: [0.2, 0.8] }, 2), false);
  assert.equal(validate({ ask: [0.9, -0.1], ans: [0.2, 0.8] }, 2), false);
  assert.equal(validate({ ask: { 0: 0.9, 1: 0.1, length: 2 }, ans: [0.2, 0.8] }, 2), false);
});

test('a huge single line is handled in linear time and capped to 20 sentences', () => {
  const t0 = Date.now();
  const s = splitSentences('word '.repeat(MAX_CHARS / 5) + '? ' + 'Sure. '.repeat(100));
  assert.ok(Date.now() - t0 < 500);
  assert.equal(s.length, 20);
});
