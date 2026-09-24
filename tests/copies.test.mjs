// Fails if the extension's copies of design/ files drift from the originals.
// Run: node tests/copies.test.mjs   (fix with npm run build, never by editing the copy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPIES } from '../scripts/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
for (const [from, to] of COPIES) {
  const a = path.join(root, from), b = path.join(root, to);
  if (!fs.existsSync(b)) { failures++; console.error(`FAIL ${to} missing (run npm run build)`); continue; }
  if (!fs.readFileSync(a).equals(fs.readFileSync(b))) { failures++; console.error(`FAIL ${to} differs from ${from} (run npm run build)`); }
}
console.log(failures ? `\n${failures} copy check(s) failed` : 'Copy checks passed');
process.exit(failures ? 1 : 0);
