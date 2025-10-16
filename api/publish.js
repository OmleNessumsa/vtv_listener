// api/publish.js (patched JSON parsing + readable errors)
import kv from '../src/lib/kv.js';
import { signPayload, safeEqual } from '../src/lib/sign.js';

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
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const bearer = process.env.PUBLISH_BEARER_TOKEN;
    if (bearer) {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ') || auth.slice(7) !== bearer) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON', detail: e.message });
    }

    const { fileKey, title, message, nonce, signature } = body || {};
    if (!fileKey || !title || !message) {
      return res.status(400).json({ ok: false, error: 'Missing fields: fileKey/title/message' });
    }
    if (!nonce) {
      return res.status(400).json({ ok: false, error: 'Missing nonce' });
    }

    const secret = process.env.SHARED_SECRET;
    if (secret) {
      const expected = signPayload(body, secret);
      if (!safeEqual(expected, signature || '')) {
        return res.status(401).json({ ok: false, error: 'Invalid signature' });
      }
    }

    const nonceKey = `file:${fileKey}:nonce:${nonce}`;
    const nonceSet = await kv.set(nonceKey, '1', { ex: 600, nx: true });
    if (nonceSet !== 'OK') {
      return res.status(409).json({ ok: false, error: 'Duplicate nonce (possible replay)' });
    }

    const verKey = `file:${fileKey}:version`;
    const lastKey = `file:${fileKey}:last`;
    const now = Date.now();
    const at = new Date(now).toISOString();
    const version = await kv.incr(verKey);
    const event = { fileKey, title, message, version, ts: now, at };

    await kv.set(lastKey, JSON.stringify(event));

    return res.status(200).json({ ok: true, version, at });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(err && err.message || err) });
  }
}
