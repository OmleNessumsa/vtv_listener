// src/lib/store.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[store] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const sb = createClient(url, key, {
  auth: { persistSession: false }
});

/**
 * Ensure tables (optional lightweight check). Not auto-migrating, just a smoke test.
 * Call once per request path to surface helpful errors if schema is missing.
 */
export async function pingSchema() {
  const { error } = await sb.from('vtv_last').select('file_key').limit(1);
  if (error) throw new Error('Supabase table "vtv_last" missing? ' + error.message);
}

/**
 * Insert nonce for replay protection. Unique on (file_key, nonce).
 * Returns true if inserted, false if duplicate.
 */
export async function insertNonce(fileKey, nonce) {
  const { error } = await sb.from('vtv_nonce').insert({ file_key: fileKey, nonce });
  if (!error) return true;
  // Duplicate key -> Postgres 23505
  if (error.code === '23505') return false;
  throw new Error('insertNonce: ' + error.message);
}

/**
 * Upsert the last event for a fileKey and increment version.
 * Returns the new { version, at, ts }.
 */
export async function upsertEvent({ fileKey, title, message }) {
  const now = Date.now();
  const at = new Date(now).toISOString();

  // read current version (ok voor lage schrijffrequentie)
  let { data: existing, error: selErr } = await sb
    .from('vtv_last')
    .select('version')
    .eq('file_key', fileKey)
    .maybeSingle();

  if (selErr) throw new Error('select vtv_last: ' + selErr.message);

  const version = (existing?.version || 0) + 1;

  const { error: upErr } = await sb.from('vtv_last').upsert({
    file_key: fileKey,
    title,
    message,
    version,
    ts: now,
    at
  });
  if (upErr) throw new Error('upsert vtv_last: ' + upErr.message);

  return { version, at, ts: now };
}

/**
 * Get the last event for a fileKey (optionally filter by since ms).
 */
export async function getLast(fileKey, sinceMs = 0) {
  const { data, error } = await sb
    .from('vtv_last')
    .select('file_key,title,message,version,ts,at')
    .eq('file_key', fileKey)
    .maybeSingle();
  if (error) throw new Error('select vtv_last: ' + error.message);
  if (!data) return null;
  if (sinceMs && data.ts <= sinceMs) return null;
  return data;
}
