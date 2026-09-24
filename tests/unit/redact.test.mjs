import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { redact, cutTail } = require('../../extension/content/extract.js');

test('emails, links and phones are replaced', () => {
  assert.equal(redact('Mail maya.chen+work@example.co.uk or see https://example.com/a?b=1 and www.example.org'), 'Mail [EMAIL] or see [LINK] and [LINK]');
  assert.equal(redact('Call +44 20 7946 0958 or (555) 010-2233 or 555.010.2233'), 'Call [PHONE] or [PHONE] or [PHONE]');
  assert.equal(redact('Site: example-supply.com | tel 07700 900123'), 'Site: [LINK] | tel [PHONE]');
});

test('long digit runs are replaced', () => {
  assert.equal(redact('Account 12345678, tracking 1Z999AA10123456784, order ORD-2026-00918'), 'Account [NUMBER], tracking [NUMBER], order [NUMBER]');
});

test('money, dates, times and short numbers are kept', () => {
  const s = 'Pay $18,400 or 2,150 dollars by 2026-06-30 at 15:10, or 12/06/2026 at 9:40 am. 40 seats, the 14th, invoice 2041, 30% deposit.';
  assert.equal(redact(s), s);
  assert.equal(redact('£1.5k plus €900 and Rs 2,00,000'), '£1.5k plus €900 and Rs 2,00,000');
});

test('digits inside kept tokens are not treated as phones', () => {
  assert.equal(redact('Meet 2026-06-30 at 10:40 and 12/06/2026'), 'Meet 2026-06-30 at 10:40 and 12/06/2026');
});

test('cutTail removes closing lines and what follows', () => {
  assert.equal(cutTail('Can you send the PDF?\n\nThanks,\nOla\n\nOla Berg | Print Manager\nwww.example-print.no | +47 22 00 00 00').trim(), 'Can you send the PDF?');
  assert.equal(cutTail('Two things.\nBest regards\nMaya Chen').trim(), 'Two things.');
  assert.equal(cutTail('Thanks for the update. Can you confirm?').trim(), 'Thanks for the update. Can you confirm?');
});

test('cutTail removes trailing contact blocks without a closing line', () => {
  assert.equal(cutTail('Shipment left today. ETA Thursday.\n\nAisha Rahman\nAccount Manager\nwww.example-supply.com | +1 (555) 010-2233').trim(), 'Shipment left today. ETA Thursday.');
});

test('cutTail keeps short trailing lines that have no contact details', () => {
  const t = 'Hi\nCan you call me\nI am free after 3';
  assert.equal(cutTail(t), t);
});

test('cutTail removes legal footers and forwarded messages', () => {
  assert.equal(cutTail('Please confirm the details.\n\nThis email and any attachments are confidential. Are you the intended recipient?').trim(), 'Please confirm the details.');
  assert.equal(cutTail('FYI below.\n\n---------- Forwarded message ----------\nFrom: X\nWould you like to submit?').trim(), 'FYI below.');
});
