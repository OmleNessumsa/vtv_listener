// api/last.js (Supabase-backed)
import { pingSchema, getLast } from '../src/lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok:false, error:'Method Not Allowed' });
    }
    const { fileKey } = req.query || {};
    let { since } = req.query || {};
    if (!fileKey) return res.status(400).json({ ok:false, error:'Missing fileKey' });

    let sinceMs = 0;
    if (since) {
      const n = Number(since);
      if (!Number.isNaN(n)) sinceMs = n;
      else {
        const d = Date.parse(since);
        if (!Number.isNaN(d)) sinceMs = d;
      }
    }

    await pingSchema();
    const event = await getLast(String(fileKey), sinceMs);
    return res.status(200).json({ ok:true, event });
  } catch (err) {
    return res.status(500).json({ ok:false, error:'Server error', detail:String(err && err.message || err) });
  }
}
