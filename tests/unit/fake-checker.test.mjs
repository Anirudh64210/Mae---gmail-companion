import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { score, check } = require('../../extension/shared/stand-in.js');
const { decide } = require('../../extension/content/decide.js');

const S = [
  'Great call yesterday.',
  'Can you send the signed contract by Thursday?',
  "What's your day rate for the extra design sprint?",
  'Could we move kickoff to Monday the 14th?'
];
const DRAFT = "Thanks, great talking yesterday. Monday the 14th works for kickoff, and I'll send the signed contract by Thursday.";

test('flags the one question the draft does not cover', () => {
  const { ask, ans } = score(S, DRAFT);
  const d = decide(S, ask, ans);
  assert.equal(d.total, 3);
  assert.deepEqual(d.missed, ["What's your day rate for the extra design sprint?"]);
});

test('answering it clears the flag', () => {
  const { ask, ans } = score(S, DRAFT + ' My day rate for the sprint is $900.');
  assert.equal(decide(S, ask, ans).missed.length, 0);
});

test('test hooks force outcomes', async () => {
  const miss = await check({ sentences: S, draft: DRAFT + ' dyaa:miss' });
  assert.equal(decide(S, miss.ask, miss.ans).missed.length, 3);
  const clean = await check({ sentences: S, draft: 'x dyaa:clean' });
  assert.equal(decide(S, clean.ask, clean.ans).missed.length, 0);
  await assert.rejects(check({ sentences: S, draft: 'dyaa:error' }));
});
