// Paper Out Loud: AI relay (a Cloudflare Worker)
//
// Holds your Claude API key so the app can ask Claude for summaries and notes without anyone
// signing in. Only someone with the passcode can use it.
//
// Settings (Cloudflare dashboard > your worker > Settings > Variables and secrets):
//   ANTHROPIC_API_KEY  (secret, required)  your key from console.anthropic.com
//   APP_PASSCODE       (secret, required)  any long phrase; the app sends it with every request
//   MODEL              (optional)          Claude model to use, default claude-sonnet-5
//   ALLOWED_ORIGINS    (optional)          comma-separated sites allowed to call this relay;
//                                          default: any site (the passcode still protects it)

const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_PROMPT_CHARS = 250000; // about a 100-page paper; stops accidental huge bills
const MAX_OUTPUT_TOKENS = 4000;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const json = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (!cors['Access-Control-Allow-Origin']) return json(403, { error: 'origin_not_allowed' });
    if (!env.ANTHROPIC_API_KEY || !env.APP_PASSCODE) return json(500, { error: 'relay_not_set_up' });
    if (request.method === 'GET' && url.pathname === '/') return json(200, { ok: true, app: 'Paper Out Loud relay' });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (!(await same(request.headers.get('X-Passcode') || '', env.APP_PASSCODE))) return json(401, { error: 'wrong_passcode' });

    if (url.pathname === '/check') return json(200, { ok: true, model: env.MODEL || DEFAULT_MODEL });
    if (url.pathname !== '/ask') return json(404, { error: 'not_found' });

    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'bad_request' }); }
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt) return json(400, { error: 'bad_request' });
    if (prompt.length > MAX_PROMPT_CHARS) return json(413, { error: 'prompt_too_large' });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.MODEL || DEFAULT_MODEL,
        max_tokens: Math.min(MAX_OUTPUT_TOKENS, Math.max(256, Number(body.max_tokens) || 2000)),
        stream: body.stream !== false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      // pass on a short, safe reason; never the key or Anthropic's full error
      let type = 'upstream_error';
      try { const e = await upstream.json(); type = (e && e.error && e.error.type) || type; } catch {}
      const status = upstream.status === 429 || upstream.status === 529 ? 429 : upstream.status === 413 ? 413 : 502;
      return json(status, { error: type, status: upstream.status });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = !list.length || !origin || list.includes(origin);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Passcode',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ok) h['Access-Control-Allow-Origin'] = list.length ? origin : '*';
  return h;
}

// compare passcodes without leaking how much of a guess was right
async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}
