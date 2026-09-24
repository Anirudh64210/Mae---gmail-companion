// Jev provider: TypeSafe AI's System One model, typed yes/no answers with calibrated probabilities.
//
// STATUS: not yet verified against the SDK. TypeSafe was not taking new accounts when this was written, so the
// call below follows docs/BRIEF.md section 6 exactly and must be checked against the SDK's src/types.ts and
// https://docs.typesafe.ai before first use. Do not guess field names; fix them here, in one place.
//
// Install:  npm install @typesafe-ai/sdk     Key: TYPESAFE_API_KEY in the deployment's secrets, never in the repo.

const MAX_Q_CHARS = 400;

// Sentences go inside question text, so they are quoted and capped. Jev answers yes or no only, which bounds
// the effect of any text that tries to steer it: the worst case is a wrong flag, never an action.
function quote(s) {
  return '"' + String(s).slice(0, MAX_Q_CHARS).replace(/["\\\r\n]/g, ' ') + '"';
}

export function jev(env = {}) {
  const apiKey = env.TYPESAFE_API_KEY;
  let clientPromise = null;

  async function client() {
    if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set');
    if (!clientPromise) {
      clientPromise = import('@typesafe-ai/sdk').then((sdk) => {
        // Confirm these export names in the SDK before use.
        const { TypeSafeClient, noul } = sdk;
        return { client: new TypeSafeClient({ apiKey }), noul };
      });
    }
    return clientPromise;
  }

  return {
    async check({ sentences, draft }) {
      const { client: c, noul } = await client();
      const questions = {};
      sentences.forEach((s, i) => {
        questions['ask_' + i] = noul('In `message`, does this sentence ask the recipient to answer, decide, confirm or do something: ' + quote(s));
        questions['ans_' + i] = noul('Does `reply` answer or address this sentence from `message`: ' + quote(s));
      });
      // One batched call per send attempt: every question in a single request.
      const res = await c.systemOne({ state: { message: sentences.join(' '), reply: draft }, questions });
      const ask = sentences.map((_, i) => Number(res.answers['ask_' + i].noul));
      const ans = sentences.map((_, i) => Number(res.answers['ans_' + i].noul));
      return { ask, ans };
    }
  };
}
