// pilot/sms.mjs — Twilio SMS + simulation + STOP/START/HELP opt-out handling.
import { collection, nowISO } from './store.mjs';
import { CFG } from './env.mjs';

const OPTOUTS = collection('optouts');
const CONVERSATIONS = collection('conversations');

// ---- Opt-out registry ----
export function isOptedOut(phone) {
  if (!phone) return false;
  const norm = _norm(phone);
  return OPTOUTS.all().some(o => o.phone === norm && o.status === 'opted_out');
}
export function optOut(phone) {
  const norm = _norm(phone);
  const list = OPTOUTS.all();
  const i = list.findIndex(o => o.phone === norm);
  const item = i >= 0 ? list[i] : { phone: norm };
  item.status = 'opted_out';
  item.updatedAt = nowISO();
  if (i >= 0) list[i] = item; else list.push(item);
  OPTOUTS.save(list);
  return item;
}
export function optIn(phone) {
  const norm = _norm(phone);
  const list = OPTOUTS.all();
  const i = list.findIndex(o => o.phone === norm);
  if (i >= 0) { list[i].status = 'opted_in'; list[i].updatedAt = nowISO(); OPTOUTS.save(list); return list[i]; }
  const item = { phone: norm, status: 'opted_in', updatedAt: nowISO() };
  list.push(item); OPTOUTS.save(list);
  return item;
}

function _norm(phone) { return String(phone || '').replace(/[^\d+]/g, ''); }

// ---- Send (live or simulated) ----
export async function sendSms({ to, body }) {
  if (!to) return { ok: false, error: 'missing "to" phone' };
  if (!CFG.LIVE_MODE || !CFG.TWILIO_ACCOUNT_SID || !CFG.TWILIO_AUTH_TOKEN || !CFG.TWILIO_PHONE_NUMBER) {
    return _simulate(to, body);
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${CFG.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${CFG.TWILIO_ACCOUNT_SID}:${CFG.TWILIO_AUTH_TOKEN}`).toString('base64');
    const form = new URLSearchParams();
    form.append('To', to); form.append('From', CFG.TWILIO_PHONE_NUMBER); form.append('Body', body);
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.message || `Twilio ${r.status}` };
    return { ok: true, sid: j.sid, simulated: false };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function _simulate(to, body) {
  return { ok: true, simulated: true, note: `SIMULATED SMS to ${to}: "${(body || '').slice(0, 80)}..."` };
}

// ---- Inbound SMS handling (STOP / START / HELP / keyword + normal reply) ----
export function handleInboundSms({ from, to, body, messageSid }) {
  const text = (body || '').trim();
  const upper = text.toUpperCase();
  let result = { action: 'reply', from, to, text };
  if (upper === 'STOP' || upper === 'UNSUBSCRIBE' || upper === 'CANCEL' || upper === 'END') {
    optOut(from);
    result.action = 'opt_out';
    result.autoReply = 'You have been unsubscribed. Reply START to opt back in. Msg rates may apply.';
  } else if (upper === 'START' || upper === 'YES' || upper === 'UNSTOP') {
    optIn(from);
    result.action = 'opt_in';
    result.autoReply = 'You have been re-subscribed. Reply STOP to opt out. Msg rates may apply.';
  } else if (upper === 'HELP') {
    result.action = 'help';
    result.autoReply = 'Reply STOP to opt out, START to opt back in, or HELP for help. Msg rates may apply.';
  }
  // log conversation
  const conv = CONVERSATIONS.all();
  conv.push({ id: messageSid || from + Date.now(), from, to, body: text, direction: 'inbound', at: nowISO(), action: result.action });
  CONVERSATIONS.save(conv.slice(-500));
  return result;
}

export function listConversations(phone) {
  const all = CONVERSATIONS.all();
  return phone ? all.filter(c => c.from === _norm(phone) || c.to === _norm(phone)) : all;
}
