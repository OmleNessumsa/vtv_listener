// src/lib/sign.js
import crypto from 'node:crypto';

/**
 * Maak een HMAC-SHA256 signature over het JSON body (zonder signature veld).
 * @param {object} payload
 * @param {string} secret
 * @returns {string} base64 signature
 */
export function signPayload(payload, secret) {
  const clone = { ...payload };
  delete clone.signature;
  const json = JSON.stringify(clone, Object.keys(clone).sort());
  const h = crypto.createHmac('sha256', secret).update(json).digest();
  return h.toString('base64');
}

/**
 * Vergelijk twee base64 signatures in timing-safe manier.
 */
export function safeEqual(a, b) {
  const ba = Buffer.from(a || '', 'base64');
  const bb = Buffer.from(b || '', 'base64');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
