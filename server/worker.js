// Cloudflare Worker that reads receipts with Claude so the API key never ships to the browser.
//
// Deploy:  npm i -g wrangler && wrangler login
//          wrangler secret put ANTHROPIC_API_KEY   (paste your key)
//          wrangler deploy
// Then paste the worker URL into the app's Settings → Proxy URL.
//
// Request body (JSON, sent by receipt.js): { image, media_type, prompt, schema }
// Response: the JSON object Claude produced, matching `schema`.

const MODEL = 'claude-opus-5';
const ALLOWED_ORIGINS = ['https://ethanliu2026.github.io', 'http://localhost:8765', 'null'];  // 'null' = file://

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    let body;
    try { body = await request.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }
    const { image, media_type, prompt, schema } = body;
    if (!image || !media_type || !prompt || !schema) return new Response('missing fields', { status: 400, headers: cors });
    if (image.length > 8_000_000) return new Response('image too large', { status: 413, headers: cors });
    // Cheap abuse brake: refuse anything that isn't a browser on an allowed origin.
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('forbidden', { status: 403, headers: cors });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          { type: 'text', text: prompt },
        ] }],
      }),
    });
    if (!res.ok) return new Response(await res.text(), { status: res.status, headers: cors });
    const msg = await res.json();
    if (msg.stop_reason === 'refusal') return new Response('declined', { status: 422, headers: cors });
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return new Response(text, { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
