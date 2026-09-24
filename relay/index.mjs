// Did You Actually Answer: relay.
// A stateless handler on the Web standard Request/Response API, so it runs unchanged on Cloudflare Workers,
// Vercel Edge Functions, Deno, or Node (see dev-server.mjs). It receives trimmed, redacted text from the
// extension, asks a provider for numbers, and returns numbers. It never logs a body and never echoes text.
//
//   POST /check   { sentences: string[], draft: string }   ->   { ask: number[], ans: number[] }

export const LIMITS = {
  bodyBytes: 65536,        // request body
  sentences: 20,           // same cap as the extension
  sentenceChars: 600,
  draftChars: 20000,
  perInstallPerHour: 120,  // a person sends far fewer replies than this
  perDay: 20000,           // global spend cap for this deployment; raise in env when needed
  providerTimeoutMs: 650   // under the extension's 700 ms fetch timeout
};

// In-memory limiter. On serverless platforms this is per instance, which is fine as a first line;
// swap in KV, Durable Objects or Redis for a strict global cap.
export function memoryLimiter() {
  const perInstall = new Map();
  let day = { key: '', n: 0 };
  return {
    allow(installId, limits, now = Date.now()) {
      const hour = Math.floor(now / 3600000), dayKey = String(Math.floor(now / 86400000));
      if (day.key !== dayKey) day = { key: dayKey, n: 0 };
      if (day.n >= limits.perDay) return false;
      const cur = perInstall.get(installId);
      const rec = cur && cur.hour === hour ? cur : { hour, n: 0 };
      if (rec.n >= limits.perInstallPerHour) return false;
      rec.n++; day.n++;
      perInstall.set(installId, rec);
      if (perInstall.size > 50000) perInstall.clear();   // bounded memory
      return true;
    }
  };
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra }
  });
}

function validPayload(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.sentences) || typeof p.draft !== 'string') return false;
  if (p.sentences.length === 0 || p.sentences.length > LIMITS.sentences) return false;
  if (p.draft.length === 0 || p.draft.length > LIMITS.draftChars) return false;
  return p.sentences.every((s) => typeof s === 'string' && s.length > 0 && s.length <= LIMITS.sentenceChars);
}

function validResult(res, n) {
  if (!res || typeof res !== 'object') return false;
  return ['ask', 'ans'].every((k) => Array.isArray(res[k]) && res[k].length === n &&
    res[k].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('provider timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// opts: { provider: { check(payload) }, allowedOrigins: string[] (empty = allow any), limiter, limits }
export function createHandler(opts) {
  const provider = opts.provider;
  const allowed = opts.allowedOrigins || [];
  const limiter = opts.limiter || memoryLimiter();
  const limits = { ...LIMITS, ...(opts.limits || {}) };

  function corsHeaders(origin) {
    if (allowed.length && !allowed.includes(origin)) return {};
    return {
      'access-control-allow-origin': origin || '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-dyaa-install',
      'access-control-max-age': '600'
    };
  }

  async function handle(request) {
    const origin = request.headers.get('origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method' }, cors);
    // Only the extension may call a deployment that lists allowed origins (chrome-extension://<id>).
    if (allowed.length && !allowed.includes(origin)) return json(403, { error: 'origin' });

    const len = Number(request.headers.get('content-length') || 0);
    if (len > limits.bodyBytes) return json(413, { error: 'size' }, cors);

    const installId = (request.headers.get('x-dyaa-install') || '').slice(0, 64) || 'anonymous';
    if (!limiter.allow(installId, limits)) return json(429, { error: 'rate' }, cors);

    let payload;
    try {
      const text = await request.text();
      if (text.length > limits.bodyBytes) return json(413, { error: 'size' }, cors);
      payload = JSON.parse(text);
    } catch (e) { return json(400, { error: 'json' }, cors); }
    if (!validPayload(payload)) return json(400, { error: 'payload' }, cors);

    try {
      const res = await withTimeout(provider.check({ sentences: payload.sentences, draft: payload.draft }), limits.providerTimeoutMs);
      if (!validResult(res, payload.sentences.length)) return json(502, { error: 'provider' }, cors);
      return json(200, { ask: res.ask, ans: res.ans }, cors);
    } catch (e) {
      return json(502, { error: 'provider' }, cors);   // never the message: it could carry text
    }
  }

  return { handle };
}
