import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { splitSentences, cutTail, spanToRange, MAX_SENTENCES } = require('../../extension/content/extract.js');

test('splits on sentence punctuation followed by space or end', () => {
  const s = splitSentences('Great call yesterday. Can you send the contract by Thursday? What is your day rate?');
  assert.deepEqual(s.map((x) => x.text), ['Great call yesterday.', 'Can you send the contract by Thursday?', 'What is your day rate?']);
});

test('offsets point at the sentence inside the source text', () => {
  const text = '  Hello there.  Could we move kickoff?';
  const s = splitSentences(text);
  for (const x of s) assert.equal(text.slice(x.start, x.end), x.text);
});

test('line breaks end a sentence even without punctuation', () => {
  const s = splitSentences('A few things\nCan you confirm the date\nThanks');
  assert.deepEqual(s.map((x) => x.text), ['A few things', 'Can you confirm the date', 'Thanks']);
});

test('decimals and closing quotes do not split', () => {
  const s = splitSentences('Is $1.5k per day ok? He said "yes." Fine.');
  assert.deepEqual(s.map((x) => x.text), ['Is $1.5k per day ok?', 'He said "yes."', 'Fine.']);
});

test('keeps the last twenty sentences', () => {
  const many = Array.from({ length: 25 }, (_, i) => `Sentence number ${i}.`).join(' ');
  const s = splitSentences(many);
  assert.equal(s.length, MAX_SENTENCES);
  assert.equal(s[0].text, 'Sentence number 5.');
});

test('cutTail drops signature and quoted history', () => {
  assert.equal(cutTail('Body text.\n-- \nMaya Chen\n555'), 'Body text.\n');
  assert.equal(cutTail('Body text.\nOn Mon, 3 Jun 2026 at 10:00, Maya <m@x.com> wrote:\n> old'), 'Body text.\n');
  assert.equal(cutTail('No tail here.'), 'No tail here.');
});

test('spanToRange maps a span across text nodes', () => {
  const segs = [{ node: 'n1', start: 0, end: 6 }, { node: 'n2', start: 6, end: 12 }];
  const calls = [];
  const doc = { createRange: () => ({ setStart: (n, o) => calls.push(['start', n, o]), setEnd: (n, o) => calls.push(['end', n, o]) }) };
  assert.ok(spanToRange(segs, 4, 10, doc));
  assert.deepEqual(calls, [['start', 'n1', 4], ['end', 'n2', 4]]);
  assert.equal(spanToRange(segs, 4, 20, doc), null);
});
