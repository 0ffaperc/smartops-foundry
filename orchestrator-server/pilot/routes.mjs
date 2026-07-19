// pilot/routes.mjs — All REST endpoints + webhooks for the Automation Pilot.
// Mounted into server.mjs for any path starting with '/api/pilot/' or '/pilot'.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CFG, validateConfig } from './env.mjs';
import { ingestLead, listLeads, getLead, markReplied } from './leads.mjs';
import { listDrafts, getDraft, editDraft, approveDraft, rejectDraft } from './approvals.mjs';
import { listJobs, cancel as cancelJob, getJob, markDelivered, startWorker, STATUSES } from './engine.mjs';
import { listSchedule, schedulerStatus, cancelForLead } from './scheduler.mjs';
import { handleInboundSms, isOptedOut, optOut, optIn, listConversations } from './sms.mjs';
import { handleEmailEvent } from './email.mjs';
import { handleInboundCall, handleCallStatus, listCalls } from './voice.mjs';
import { verifyResend, verifyTwilio, isDuplicateEvent } from './webhooks.mjs';
import { collection } from './store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
let _workerStarted = false;
function ensureWorker() { if (!_workerStarted) { startWorker(); _workerStarted = true; } }

// ---- helpers (self-contained so this module is portable) ----
function send(res, status, obj, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', ...headers });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
function readRaw(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}
function validatePhone(p) { return p && /^\+?[\d]{10,15}$/.test(String(p).replace(/[\s()-]/g, '')); }
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '')); }

// ---- main mount ----
// Returns true if the request was handled (caller should return), false otherwise.
export async function mountPilotRoutes(req, res) {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return true; }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  ensureWorker();

  // ---- Pilot HTML page (self-contained, no Vite needed) ----
  if ((req.method === 'GET') && (p === '/pilot' || p === '/pilot.html')) {
    const html = readFileSync(join(__dirname, 'pilot.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return true;
  }

  if (!p.startsWith('/api/pilot/')) return false;
  const segs = p.split('/').filter(Boolean); // ['api','pilot',...rest]
  // Read raw body ONCE for POST/PUT. JSON routes parse it; webhook routes use raw.
  // (Reading twice would hang — the second reader never sees 'end'.)
  const rawBody = (req.method === 'POST' || req.method === 'PUT') ? await readRaw(req) : '';
  let body = {};
  if (rawBody) { try { body = JSON.parse(rawBody); } catch { body = {}; } }

  // GET /api/pilot/health
  if (req.method === 'GET' && segs[2] === 'health') {
    send(res, 200, {
      ok: true,
      liveMode: CFG.LIVE_MODE,
      testMode: CFG.TEST_MODE,
      model: CFG.MODEL,
      hasOpenRouter: !!CFG.OPENROUTER_API_KEY,
      hasTwilio: !!(CFG.TWILIO_ACCOUNT_SID && CFG.TWILIO_AUTH_TOKEN),
      hasResend: !!(CFG.RESEND_API_KEY && CFG.RESEND_FROM_EMAIL),
      forwardPhone: CFG.TEST_FORWARD_PHONE ? 'configured' : 'unset',
      configIssues: validateConfig(),
      statuses: STATUSES,
    });
    return true;
  }

  // ---- Leads ----
  if (req.method === 'GET' && segs[2] === 'leads') { send(res, 200, { ok: true, leads: listLeads(body.filter || {}) }); return true; }
  if (req.method === 'POST' && segs[2] === 'leads') {
    try {
      if (!body.name && !body.phone && !body.email) { send(res, 400, { ok: false, error: 'lead requires name, phone, or email' }); return true; }
      if (body.phone && !validatePhone(body.phone)) { send(res, 400, { ok: false, error: 'invalid phone' }); return true; }
      if (body.email && !validateEmail(body.email)) { send(res, 400, { ok: false, error: 'invalid email' }); return true; }
      const r = await ingestLead(body);
      send(res, 200, { ok: true, lead: r.lead, drafts: r.drafts });
    } catch (e) { send(res, 400, { ok: false, error: String(e) }); }
    return true;
  }
  if (req.method === 'GET' && segs[2] === 'leads' && segs[3]) { send(res, 200, { ok: true, lead: getLead(segs[3]) }); return true; }

  // ---- Drafts / approvals ----
  if (req.method === 'GET' && segs[2] === 'drafts') { send(res, 200, { ok: true, drafts: listDrafts(body.filter || {}) }); return true; }
  if (req.method === 'PUT' && segs[2] === 'drafts' && segs[3]) {
    const d = editDraft(segs[3], body);
    send(res, d ? 200 : 404, d ? { ok: true, draft: d } : { ok: false, error: 'not found / not editable' });
    return true;
  }
  if (req.method === 'POST' && segs[2] === 'drafts' && segs[3] === 'approve' && false) {}
  // approve/reject: POST /api/pilot/drafts/:id/approve | /reject
  if (req.method === 'POST' && segs[2] === 'drafts' && segs[4] === 'approve') {
    const d = await approveDraft(segs[3]);
    send(res, d ? 200 : 404, d ? { ok: true, draft: d } : { ok: false, error: 'not found' });
    return true;
  }
  if (req.method === 'POST' && segs[2] === 'drafts' && segs[4] === 'reject') {
    const d = await rejectDraft(segs[3]);
    send(res, d ? 200 : 404, d ? { ok: true, draft: d } : { ok: false, error: 'not found' });
    return true;
  }

  // ---- Jobs (queue + history) ----
  if (req.method === 'GET' && segs[2] === 'jobs') { send(res, 200, { ok: true, jobs: listJobs(body.filter || {}) }); return true; }
  if (req.method === 'POST' && segs[2] === 'jobs' && segs[4] === 'cancel') {
    const j = cancelJob(segs[3]);
    send(res, j ? 200 : 404, j ? { ok: true, job: j } : { ok: false, error: 'not found' });
    return true;
  }

  // ---- Scheduler ----
  if (req.method === 'GET' && segs[2] === 'scheduler') { send(res, 200, { ok: true, status: schedulerStatus(), schedule: listSchedule({ status: 'scheduled' }) }); return true; }
  if (req.method === 'POST' && segs[2] === 'scheduler' && segs[3] === 'cancel' && segs[4]) {
    const n = cancelForLead(segs[4]);
    send(res, 200, { ok: true, cancelled: n });
    return true;
  }

  // ---- Opt-outs (debug/admin) ----
  if (req.method === 'GET' && segs[2] === 'optouts') { send(res, 200, { ok: true, optouts: collection('optouts').all() }); return true; }

  // ---- Conversations ----
  if (req.method === 'GET' && segs[2] === 'conversations') { send(res, 200, { ok: true, conversations: listConversations(url.searchParams.get('phone') || undefined) }); return true; }

  // ---- Calls ----
  if (req.method === 'GET' && segs[2] === 'calls') { send(res, 200, { ok: true, calls: listCalls() }); return true; }

  // ---- Webhook health ----
  if (req.method === 'GET' && segs[2] === 'webhooks' && segs[3] === 'health') {
    send(res, 200, {
      ok: true,
      endpoints: {
        sms: CFG.PUBLIC_BASE_URL + '/api/pilot/sms/webhook',
        voice_incoming: CFG.PUBLIC_BASE_URL + '/api/pilot/voice/incoming',
        voice_status: CFG.PUBLIC_BASE_URL + '/api/pilot/voice/status',
        email: CFG.PUBLIC_BASE_URL + '/api/pilot/email/webhook',
      },
      resendSecretConfigured: !!CFG.RESEND_WEBHOOK_SECRET,
      twilioSecretConfigured: !!CFG.TWILIO_AUTH_TOKEN,
    });
    return true;
  }

  // ---- SMS webhook (inbound replies + STOP/START/HELP + delivery) ----
  if (req.method === 'POST' && segs[2] === 'sms' && segs[3] === 'webhook') {
    const raw = rawBody;
    let verified = true;
    if (CFG.LIVE_MODE && CFG.TWILIO_AUTH_TOKEN) {
      const v = verifyTwilio(req.headers, raw, CFG.PUBLIC_BASE_URL + p);
      verified = v.ok;
    }
    if (!verified) { send(res, 403, { ok: false, error: 'invalid Twilio signature' }); return true; }
    const params = new URLSearchParams(raw);
    const from = params.get('From') || '';
    const to = params.get('To') || '';
    const text = params.get('Body') || '';
    const sid = params.get('MessageSid') || '';
    if (isDuplicateEvent(sid)) { send(res, 200, { ok: true, duplicate: true }); return true; }
    const r = handleInboundSms({ from, to, body: text, messageSid: sid });
    // if normal reply → mark lead replied + cancel follow-ups
    if (r.action === 'reply' && from) markReplied(from);
    // respond with TwiML: auto-reply for STOP/START/HELP, else empty
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    if (r.autoReply) twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${_esc(r.autoReply)}</Message></Response>`;
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return true;
  }

  // ---- Voice: incoming call ----
  if (req.method === 'POST' && segs[2] === 'voice' && segs[3] === 'incoming') {
    const raw = rawBody;
    let verified = true;
    if (CFG.LIVE_MODE && CFG.TWILIO_AUTH_TOKEN) {
      const v = verifyTwilio(req.headers, raw, CFG.PUBLIC_BASE_URL + p);
      verified = v.ok;
    }
    if (!verified) { send(res, 403, { ok: false, error: 'invalid Twilio signature' }); return true; }
    const params = new URLSearchParams(raw);
    const twiml = handleInboundCall({ from: params.get('From') || '', to: params.get('To') || '', callSid: params.get('CallSid') || '' });
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return true;
  }
  // ---- Voice: status callback ----
  if (req.method === 'POST' && segs[2] === 'voice' && segs[3] === 'status') {
    const raw = rawBody;
    const params = new URLSearchParams(raw);
    const r = handleCallStatus({
      from: params.get('From') || (url.searchParams.get('From') || ''),
      to: params.get('To') || (url.searchParams.get('To') || ''),
      callSid: params.get('CallSid') || '',
      callStatus: params.get('CallStatus') || params.get('DialCallStatus') || 'completed',
    });
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return true;
  }

  // ---- Email webhook (Resend: delivery / bounce) ----
  if (req.method === 'POST' && segs[2] === 'email' && segs[3] === 'webhook') {
    const raw = rawBody;
    const v = verifyResend(req.headers, raw);
    if (!v.ok) { send(res, 403, { ok: false, error: 'invalid Resend signature: ' + v.error }); return true; }
    let payload;
    try { payload = JSON.parse(raw); } catch { send(res, 400, { ok: false, error: 'invalid JSON' }); return true; }
    const evtId = req.headers['svix-id'] || payload?.data?.email?.id || '';
    if (isDuplicateEvent(evtId)) { send(res, 200, { ok: true, duplicate: true }); return true; }
    const r = handleEmailEvent(payload);
    // map delivery → mark job delivered
    if (r.type && /delivered/i.test(r.type) && r.emailId) {
      const job = listJobs({}).find(j => j.externalId === r.emailId);
      if (job) markDelivered(job.id, r.emailId);
    }
    send(res, 200, { ok: true, event: r });
    return true;
  }

  send(res, 404, { ok: false, error: 'pilot endpoint not found: ' + p });
  return true;
}

function _esc(s) { return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
