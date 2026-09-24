// Mae sprite guardrails. Run: node tests/sprite.test.mjs
// Fails if anyone edits design/mae-sprite.js in a way that breaks symmetry or clean edges.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const MAE = require('../design/mae-sprite.js');

const P = MAE.P;
let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL ' + msg); };

// 1. Resting frames are mirror-symmetric (x <-> 19 - x). Motion frames (eye scan, foot tap, blink) are excluded on purpose.
const REST = { asleep: [1], checking: [1], waiting: [1, 23], unimpressed: [5], relieved: [1, 5], sealed: [0, 3, 9, 12, 13, 16, 20], shrug: [1, 5] };
for (const [mood, ticks] of Object.entries(REST)) {
  for (const t of ticks) {
    const g = MAE.build(mood, t, { noFx: true });
    let bad = 0;
    for (let y = 0; y < MAE.H; y++) for (let x = 0; x < MAE.W / 2; x++) if (g.c[y][x] !== g.c[y][MAE.W - 1 - x]) bad++;
    if (bad) fail(`${mood} t${t}: ${bad} asymmetric pixels`);
  }
}

// 2. No facial feature, blush or teeth pixel touches the outline or empty space (1px margin inside the silhouette).
const FACE = new Set([P.feat, P.blush]);
for (const mood of MAE.MOODS) {
  for (let t = 0; t < 24; t++) {
    const g = MAE.build(mood, t, { noFx: true });
    for (let y = 0; y < MAE.H; y++) for (let x = 0; x < MAE.W; x++) {
      if (!FACE.has(g.c[y][x])) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = g.get(x + dx, y + dy);
        if (n === null || n === P.out) fail(`${mood} t${t}: feature at ${x},${y} touches the edge`);
      }
    }
  }
}

console.log(failures ? `\n${failures} sprite check(s) failed` : 'Sprite checks passed');
process.exit(failures ? 1 : 0);
