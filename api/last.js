// api/last.js
import { pingSchema, getLast } from '../src/lib/store.js';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // of jouw exacte domein
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET,OPTIONS');
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

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ok:true, event });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ ok:false, error:'Server error', detail:String(err?.message || err) });
  }
}
