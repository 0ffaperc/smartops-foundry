// pilot/email.mjs — Resend email + simulation + delivery/bounce via webhooks.
import { collection, nowISO } from './store.mjs';
import { CFG } from './env.mjs';

const EMAIL_EVENTS = collection('events'); // reused via webhooks dedupe; keep separate event log here
const DELIVERIES = collection('conversations'); // reuse: log outbound/inbound emails

export async function sendEmail({ to, subject, body }) {
  if (!to) return { ok: false, error: 'missing "to" email' };
  if (!CFG.LIVE_MODE || !CFG.RESEND_API_KEY || !CFG.RESEND_FROM_EMAIL) {
    return _simulate(to, subject, body);
  }
  // allowlist enforcement done in engine; double-check here too
  if (CFG.TEST_MODE && CFG.TEST_EMAIL_ALLOWLIST.length && !CFG.TEST_EMAIL_ALLOWLIST.includes(to)) {
    return { ok: false, error: `test mode: ${to} not in TEST_EMAIL_ALLOWLIST` };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CFG.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: CFG.RESEND_FROM_EMAIL, to: [to], subject: subject || '(no subject)', text: body }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.message || `Resend ${r.status}` };
    return { ok: true, emailId: j.id, simulated: false };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function _simulate(to, subject, body) {
  return { ok: true, simulated: true, emailId: 'sim_' + Date.now().toString(36), note: `SIMULATED EMAIL to ${to} | subject: "${(subject||'').slice(0,60)}" | body: "${(body||'').slice(0,80)}..."` };
}

// ---- Webhook event handling (delivery / bounce) ----
export function handleEmailEvent(payload) {
  // Resend webhook event shape: { type, created_at, email: { id, from, to, subject } }
  const evt = payload?.data?.email || payload?.email || payload || {};
  const type = payload?.type || payload?.event || 'unknown';
  const log = DELIVERIES.all();
  log.push({
    id: evt.id || Date.now().toString(36),
    type, // 'email.delivered' | 'email.bounced' | 'email.delivery_status_changed'
    to: evt.to || payload.to,
    subject: evt.subject,
    at: payload?.created_at || nowISO(),
    direction: 'event',
  });
  DELIVERIES.save(log.slice(-500));
  return { type, emailId: evt.id };
}
