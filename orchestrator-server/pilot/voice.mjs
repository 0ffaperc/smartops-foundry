// pilot/voice.mjs — Twilio Voice: incoming, forward, missed-call text-back.
// No conversational AI. Forwards inbound calls to TEST_FORWARD_PHONE (env).
// On missed/no-answer → triggers an SMS text-back via the engine (approval gate).
import { CFG } from './env.mjs';
import { createJob } from './engine.mjs';
import { isOptedOut } from './sms.mjs';
import { collection, nowISO, uid } from './store.mjs';

const CALLS = collection('calls');

export function listCalls() { return CALLS.all().sort((a, b) => (b.at || '').localeCompare(a.at || '')); }

// ---- Inbound call → TwiML ----
// Called by the voice webhook. Returns TwiML response string.
export function handleInboundCall({ from, to, callSid }) {
  CALLS.upsert({ id: callSid || uid(), from, to, at: nowISO(), status: 'ringing' });
  const forward = CFG.TEST_FORWARD_PHONE;
  const baseUrl = CFG.PUBLIC_BASE_URL;
  if (forward) {
    // Forward to configured phone; on no-answer/busy, hit the missed-call webhook.
    return _twiml(`
      <Dial answerOnBridge="true" timeout="20" action="${baseUrl}/api/pilot/voice/status?From=${encodeURIComponent(from)}&To=${encodeURIComponent(to)}" method="POST">
        <Number>${_esc(forward)}</Number>
      </Dial>`);
  }
  // No forward configured → missed-call text-back immediately
  _enqueueMissedCallBack(from, to, callSid);
  return _twiml(`<Say voice="Polly.Joanna">Thank you for calling. We will text you shortly.</Say><Hangup/>`);
}

// ---- Call status callback ----
// status: completed | no-answer | busy | failed | canceled
export function handleCallStatus({ from, to, callSid, callStatus }) {
  CALLS.upsert({ id: callSid || uid(), from, to, at: nowISO(), status: callStatus });
  if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
    _enqueueMissedCallBack(from, to, callSid);
  }
  return { status: callStatus, textBackEnqueued: ['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus) };
}

// Enqueue a missed-call text-back SMS as a draft job (pending approval).
function _enqueueMissedCallBack(from, to, callSid) {
  if (!from) return null;
  if (isOptedOut(from)) return null;
  const job = createJob({
    draftId: 'missedcall-' + (callSid || uid()),
    leadId: '',
    channel: 'sms',
    to: from,
    subject: '',
    body: `Hi, this is ${'the business'}. Sorry we missed your call! How can we help you today? Reply here or call us back.`,
    businessName: '',
  });
  return job; // stays 'pending' until approved in the pilot
}

function _twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}
function _esc(s) { return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
