// api/publish.js (Supabase-backed + CORS)
import { pingSchema, insertNonce, upsertEvent } from '../src/lib/store.js';
import { signPayload, safeEqual } from '../src/lib/sign.js';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // of je exacte domein
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch {}
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST,OPTIONS');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const bearer = process.env.PUBLISH_BEARER_TOKEN;
    if (bearer) {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ') || auth.slice(7) !== bearer) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    // (Optioneel) QStash signature verify kan hier, indien je via QStash levert.

    let body;
    try { body = await readJson(req); }
    catch (e) { return res.status(400).json({ ok:false, error:'Invalid JSON', detail:e.message }); }

    const { fileKey, title, message, nonce, signature } = body || {};
    if (!fileKey || !title || !message) {
      return res.status(400).json({ ok:false, error:'Missing fields: fileKey/title/message' });
    }
    if (!nonce) {
      return res.status(400).json({ ok:false, error:'Missing nonce' });
    }

    const secret = process.env.SHARED_SECRET;
    if (secret) {
      const expected = signPayload(body, secret);
      if (!safeEqual(expected, signature || '')) {
        return res.status(401).json({ ok:false, error:'Invalid signature' });
      }
    }

    await pingSchema();

    const ok = await insertNonce(fileKey, nonce);
