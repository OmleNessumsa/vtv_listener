// api/last.js (patched with readable errors)
import kv from '../src/lib/kv.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    const { fileKey } = req.query || {};
    let { since } = req.query || {};
    if (!fileKey) {
      return res.status(400).json({ ok: false, error: 'Missing fileKey' });
    }
    let sinceMs = 0;
    if (since) {
      const n = Number(since);
      if (!Number.isNaN(n)) sinceMs = n;
      else {
        const d = Date.parse(since);
        if (!Number.isNaN(d)) sinceMs = d;
      }
    }

    const lastKey = `file:${fileKey}:last`;
    const json = await kv.get(lastKey);
    if (!json) return res.status(200).json({ ok: true, event: null });

    const event = typeof json === 'string' ? JSON.parse(json) : json;
    if (sinceMs && event.ts <= sinceMs) {
      return res.status(200).json({ ok: true, event: null });
    }
    return res.status(200).json({ ok: true, event });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(err && err.message || err) });
  }
}
