// api/publish.js
import kv from '../src/lib/kv.js';
import { signPayload, safeEqual } from '../src/lib/sign.js';

/**
 * Body:
 * {
 *   fileKey: string,
 *   title: string,
 *   message: string,
 *   nonce: string,
 *   signature?: string
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    body = req.body && Object.keys(req.body).length ? req.body : JSON.parse(req.read ? await new Promise((r)=>{
      let b=''; req.on('data',d=>b+=d); req.on('end',()=>r(b));
    }) : '{}');
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const { fileKey, title, message, nonce, signature } = body || {};
  if (!fileKey || !title || !message) {
    return res.status(400).json({ ok: false, error: 'Missing fields: fileKey/title/message' });
  }

  // Replay protection (optional but recommended)
  if (!nonce) {
    return res.status(400).json({ ok: false, error: 'Missing nonce' });
  }
  const nonceKey = `file:${fileKey}:nonce:${nonce}`;
  const nonceSet = await kv.set(nonceKey, '1', { ex: 600, nx: true }); // 10 min TTL, only if not exists
  if (nonceSet !== 'OK') {
    return res.status(409).json({ ok: false, error: 'Duplicate nonce (possible replay)' });
  }

  // HMAC verification (optional)
  const secret = process.env.SHARED_SECRET;
  if (secret) {
    const expected = signPayload(body, secret);
    if (!safeEqual(expected, signature || '')) {
      return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }
  }

  // Store event
  const lastKey = `file:${fileKey}:last`;
  const now = Date.now();
  const at = new Date(now).toISOString();

  // Atomically increment version counter
  const verKey = `file:${fileKey}:version`;
  const version = await kv.incr(verKey);
  const event = { fileKey, title, message, version, ts: now, at };

  await kv.set(lastKey, JSON.stringify(event));

  return res.status(200).json({ ok: true, version, at });
}
