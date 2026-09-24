// Visual regression for the design-locked UI.
// Run:    node tests/visual.mjs            (compare against design/baselines)
// Update: node tests/visual.mjs --update  (ONLY when the user has approved a design change)
// Needs:  npm i -D playwright pngjs pixelmatch && npx playwright install chromium
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const update = process.argv.includes('--update');
const MAX_DIFF_RATIO = 0.001; // 0.1% of pixels

const SHOTS = [
  { name: 'nudge-states', page: 'design/reference/nudge-reference.html?freeze', selector: '#grid', viewport: { width: 1100, height: 1800 } },
  { name: 'sprite-sheet', page: 'design/reference/sprite-sheet.html', selector: '#c', viewport: { width: 1100, height: 1100 } },
];

const browser = await chromium.launch();
let failed = 0;
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: s.viewport, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(root, s.page.split('?')[0])).href + (s.page.includes('?') ? '?' + s.page.split('?')[1] : ''));
  await page.waitForTimeout(600);
  const buf = await page.locator(s.selector).screenshot({ animations: 'disabled' });
  const file = path.join(root, 'design/baselines', s.name + '.png');
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, buf);
    console.log('baseline written', s.name);
    continue;
  }
  const a = PNG.sync.read(fs.readFileSync(file)), b = PNG.sync.read(buf);
  if (a.width !== b.width || a.height !== b.height) { failed++; console.error(`FAIL ${s.name}: size ${b.width}x${b.height} vs baseline ${a.width}x${a.height}`); continue; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const ratio = n / (a.width * a.height);
  if (ratio > MAX_DIFF_RATIO) {
    failed++;
    fs.writeFileSync(path.join(root, 'design/baselines', s.name + '.diff.png'), PNG.sync.write(diff));
    console.error(`FAIL ${s.name}: ${(ratio * 100).toFixed(2)}% pixels differ (see ${s.name}.diff.png)`);
  } else console.log(`ok   ${s.name}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
