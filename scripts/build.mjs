// Copies the design-locked UI files into the extension, byte for byte.
// Run: npm run build   (never edit extension/content/mae-sprite.js or nudge.js directly)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COPIES = [
  ['design/mae-sprite.js', 'extension/content/mae-sprite.js'],
  ['design/nudge.js', 'extension/content/nudge.js'],
  ...['', '-paused'].flatMap((v) => [16, 32, 48, 128].map((n) => [`design/icons/mae${v}-${n}.png`, `extension/icons/mae${v}-${n}.png`])),
];

export function build() {
  for (const [from, to] of COPIES) {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    // read + write, not copyFile: copyFile keeps macOS quarantine flags from the zip, and Chrome then refuses the file
    fs.writeFileSync(path.join(root, to), fs.readFileSync(path.join(root, from)));
    console.log(`copied ${from} -> ${to}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
