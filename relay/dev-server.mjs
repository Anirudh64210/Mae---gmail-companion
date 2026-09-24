// Local relay for development: node relay/dev-server.mjs   ->   http://localhost:8787/check
// Reads relay/.env if present (KEY=value lines). With TYPESAFE_API_KEY set it uses Jev, otherwise the stub.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './index.mjs';
import { stub } from './providers/stub.mjs';
import { jev } from './providers/jev.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
const envFile = path.join(here, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const useJev = (env.PROVIDER || (env.TYPESAFE_API_KEY ? 'jev' : 'stub')) === 'jev';
const provider = useJev ? jev(env) : stub;
const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const handler = createHandler({ provider, allowedOrigins });
const port = Number(env.PORT || 8787);

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
  });
  const response = await handler.handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`relay listening on http://localhost:${port}/check  provider=${useJev ? 'jev' : 'stub'}  origins=${allowedOrigins.join(',') || 'any'}`);
});
