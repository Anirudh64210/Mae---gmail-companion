// Did You Actually Answer: evaluation.
// Runs every fixture pair through the real extraction and a checker, then reports precision and recall of "missed".
//
//   npm run eval                 fake checker (word matching, no network)
//   CHECKER=relay RELAY_URL=https://... npm run eval    the deployed relay (milestone 4)
//   npm run eval -- --verbose    print every wrong flag and every miss not caught
//
// Launch bar (docs/BRIEF.md section 8): precision >= 0.90. Recall can be lower.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { splitSentences, cutTail, redact } = require('../extension/content/extract.js');
const { decide, CONFIG } = require('../extension/content/decide.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');
const which = process.env.CHECKER || 'fake';

const checker = which === 'relay'
  ? { check: async (input) => {
      const url = process.env.RELAY_URL;
      if (!url) throw new Error('RELAY_URL is required for CHECKER=relay');
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      if (!r.ok) throw new Error(`relay ${r.status}`);
      return r.json();
    } }
  : require('../extension/shared/stand-in.js');

const fixtures = fs.readdirSync(path.join(here, 'fixtures')).filter((f) => f.endsWith('.json')).sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8')));

// Sentence-level counts. A "positive" is a sentence flagged as missed.
const totals = { tp: 0, fp: 0, fn: 0, tn: 0 };
const byDomain = {};
const emails = { tp: 0, fp: 0, fn: 0, tn: 0 };   // email level: should Mae show at all?
const problems = [];
const labelErrors = [];

function find(sentences, q) {
  const needle = q.toLowerCase();
  const hits = sentences.filter((s) => s.toLowerCase().includes(needle));
  return hits.length === 1 ? hits[0] : null;
}
function tally(t, key) { t[key]++; }

for (const fx of fixtures) {
  // Same path as the extension: trim, split, redact what the checker sees. Labels match the page text.
  const sentences = splitSentences(cutTail(fx.message)).map((s) => s.text);
  const safe = sentences.map(redact);
  const draft = redact(cutTail(fx.draft).trim());
  const dom = (byDomain[fx.domain] ||= { tp: 0, fp: 0, fn: 0, tn: 0, n: 0 });
  dom.n++;

  // Labels: map each labelled ask to the split sentence that contains it.
  const missedLabel = new Set(), askLabel = new Set();
  for (const a of fx.asks) {
    const s = find(sentences, a.q);
    if (!s) { labelErrors.push(`${fx.id}: label not found or ambiguous in split sentences: "${a.q}"`); continue; }
    askLabel.add(s);
    if (a.missed) missedLabel.add(s);
  }

  let flagged = new Set();
  if (sentences.length && draft) {
    let res;
    try { res = await checker.check({ sentences: safe, draft }); }
    catch (e) { problems.push(`${fx.id}: checker error: ${e.message}`); continue; }
    const d = decide(sentences, res.ask, res.ans, CONFIG);
    flagged = new Set(d.missed);
  }

  for (const s of sentences) {
    const isMissed = missedLabel.has(s), isFlagged = flagged.has(s);
    const key = isFlagged ? (isMissed ? 'tp' : 'fp') : (isMissed ? 'fn' : 'tn');
    tally(totals, key); tally(dom, key);
    if (verbose && key === 'fp') problems.push(`${fx.id} WRONG FLAG   "${s}"`);
    if (verbose && key === 'fn') problems.push(`${fx.id} NOT CAUGHT   "${s}"`);
  }
  const shouldShow = missedLabel.size > 0, didShow = flagged.size > 0;
  tally(emails, didShow ? (shouldShow ? 'tp' : 'fp') : (shouldShow ? 'fn' : 'tn'));
}

const pr = (t) => {
  const p = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 1, r = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 1;
  return { p, r };
};
const fmt = (x) => (x * 100).toFixed(0).padStart(3) + '%';

console.log(`\nDid You Actually Answer: eval (${which} checker, ${fixtures.length} fixtures, thresholds ask>=${CONFIG.askMin} ans<=${CONFIG.ansMax})\n`);
console.log('domain'.padEnd(24) + ' n   prec  recall  flags(right/wrong)  missed not caught');
for (const [name, t] of Object.entries(byDomain).sort()) {
  const { p, r } = pr(t);
  console.log(name.padEnd(24) + String(t.n).padStart(2) + '  ' + fmt(p) + '   ' + fmt(r) + '      ' + `${t.tp}/${t.fp}`.padStart(6) + '            ' + t.fn);
}
const all = pr(totals), em = pr(emails);
console.log('\nsentence level   precision ' + fmt(all.p) + '   recall ' + fmt(all.r) + `   (right flags ${totals.tp}, wrong flags ${totals.fp}, not caught ${totals.fn})`);
console.log('email level      precision ' + fmt(em.p) + '   recall ' + fmt(em.r) + `   (Mae shown when she should ${emails.tp}, shown wrongly ${emails.fp}, stayed hidden wrongly ${emails.fn})`);
console.log(`\nlaunch bar: precision >= 0.90 ... ${all.p >= 0.9 ? 'MET' : 'NOT MET'}`);

if (labelErrors.length) { console.log('\nFixture label problems (fix the fixture):'); labelErrors.forEach((l) => console.log('  ' + l)); }
if (problems.length) { console.log('\nDetails:'); problems.forEach((l) => console.log('  ' + l)); }
process.exit(labelErrors.length ? 2 : 0);
