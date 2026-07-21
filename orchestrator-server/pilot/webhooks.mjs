// pilot/webhooks.mjs — Signature verification + duplicate-event protection.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { collection, nowISO, uid } from './store.mjs';
import { CFG } from './env.mjs';

// ---- Resend webhook signature ----
// Resend sends `svix-id`, `svix-timestamp`, `svix-signature` headers.
// Signing string: `${svix-id}.${svix-timestamp}.${rawBody}`.
export function verifyResend(headers, rawBody) {
  if (!CFG.RESEND_WEBHOOK_SECRET) return { ok: false, error: 'RESEND_WEBHOOK_SECRET not configured' };
  const msgId = headers['svix-id'] || headers['Svix-Id'];
  const ts = headers['svix-timestamp'] || headers['Svix-Timestamp'];
  const sigHeader = headers['svix-signature'] || headers['Svix-Signature'];
  if (!msgId || !ts || !sigHeader) return { ok: false, error: 'missing svix headers' };
  // reject stale timestamps (>5 min)
  const ageMs = Math.abs(Date.now() - (parseInt(ts, 10) * 1000));
  if (ageMs > 5 * 60 * 1000) return { ok: false, error: 'stale timestamp' };
  const toSign = `${msgId}.${ts}.${rawBody}`;
  const expected = createHmac('sha256', CFG.RESEND_WEBHOOK_SECRET).update(toSign).digest('base64');
  const passed = sigHeader.split(' ').map(s => s.replace(/^v1,?/, '').trim());
  const ok = passed.some(sig => _safeEqual(sig, expected));
  return { ok, msgId };
}

// ---- Twilio webhook signature ----
// Twilio signs with `X-Twilio-Signature` = HMAC-SHA256(AuthToken, url+params).
export function verifyTwilio(headers, rawBody, url) {
  if (!CFG.TWILIO_AUTH_TOKEN) return { ok: false, error: 'TWILIO_AUTH_TOKEN not configured' };
  const sig = headers['x-twilio-signature'] || headers['X-Twilio-Signature'];
  if (!sig) return { ok: false, error: 'missing X-Twilio-Signature' };
  // Twilio sends form-encoded body; reconstruct the signing string url+sorted params.
  // rawBody is the raw form string.
  const params = new URLSearchParams(rawBody);
  const sorted = [...params.keys()].sort().map(k => k + params.get(k)).join('');
  const expected = createHmac('sha256', CFG.TWILIO_AUTH_TOKEN).update(url + sorted).digest('base64');
  return { ok: _safeEqual(sig, expected) };
}

function _safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

// ---- Duplicate event protection ----
// Track event IDs (Resend svix-id / Twilio MessageSid) we've already processed.
const events = collection('events');
export function isDuplicateEvent(externalId) {
  if (!externalId) return false;
  const list = events.all();
  if (list.some(e => e.externalId === externalId)) return true;
  // record + prune in one save (upsert+save would lose the just-added item via stale ref)
  list.push({ id: uid(), externalId, seen: nowISO() });
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fresh = list.filter(e => new Date(e.seen).getTime() > cutoff);
  events.save(fresh);
  return false;
}
