// Stand-in provider: the same word matcher the extension runs locally. For development and the eval only.
// It is not the engine (see `npm run eval`).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const standIn = require('../../extension/shared/stand-in.js');

export const stub = { check: (payload) => standIn.check(payload) };
