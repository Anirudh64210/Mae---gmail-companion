// Cloudflare Worker entry. Deploy with wrangler; set secrets with `wrangler secret put TYPESAFE_API_KEY`.
// Vars: PROVIDER=jev|stub (default: jev when the key is set, else stub), ALLOWED_ORIGINS=chrome-extension://<id>,...
import { createHandler } from './index.mjs';
import { jev } from './providers/jev.mjs';

let handler = null;
function build(env) {
  const useJev = (env.PROVIDER || (env.TYPESAFE_API_KEY ? 'jev' : 'stub')) === 'jev';
  const providerPromise = useJev ? Promise.resolve(jev(env)) : import('./providers/stub.mjs').then((m) => m.stub);
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const limits = {};
  if (env.PER_DAY) limits.perDay = Number(env.PER_DAY);
  return providerPromise.then((provider) => createHandler({ provider, allowedOrigins, limits }));
}

export default {
  async fetch(request, env) {
    handler = handler || await build(env);
    return handler.handle(request);
  }
};
