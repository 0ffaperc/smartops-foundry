// pilot/engine.mjs — Persistent automation engine.
// Job lifecycle: pending → approved → (simulated|sent) → delivered|failed|cancelled.
// Features: queue, retries with backoff, cancellation, persistence after restart,
// live/simulate modes, allowlist enforcement.
import { collection, nowISO, uid } from './store.mjs';
import { CFG } from './env.mjs';
import { sendSms, isOptedOut } from './sms.mjs';
import { sendEmail } from './email.mjs';

const JOBS = collection('jobs');
export const STATUSES = ['pending', 'approved', 'simulated', 'sent', 'delivered', 'failed', 'cancelled'];
export const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [5000, 15000, 60000]; // 5s, 15s, 60s

export function createJob({ draftId, channel, to, subject, body, leadId, businessName }) {
  const job = {
    id: uid(),
    draftId,
    leadId,
    channel,            // 'sms' | 'email' | 'voice'
    to,
    subject: subject || '',
    body,
    businessName: businessName || '',
    status: 'pending',
    attempts: 0,
    lastError: '',
    externalId: '',      // Twilio MessageSid / Resend email id
    createdAt: nowISO(),
    updatedAt: nowISO(),
    scheduledFor: '',    // ISO when to run (empty = run on approve)
  };
  JOBS.upsert(job);
  return job;
}

export function approve(jobId) { return _setStatus(jobId, 'approved'); }
export function cancel(jobId) {
  const j = JOBS.byId(jobId);
  if (!j) return null;
  // can't cancel already-sent/delivered
  if (['sent', 'delivered', 'simulated'].includes(j.status)) return j;
  return _setStatus(jobId, 'cancelled');
}
export function reject(jobId) { return cancel(jobId); } // alias for approval reject
export function getJob(jobId) { return JOBS.byId(jobId); }
export function listJobs(filter = {}) {
  let list = JOBS.all();
  if (filter.status) list = list.filter(j => j.status === filter.status);
  if (filter.leadId) list = list.filter(j => j.leadId === filter.leadId);
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// Scheduler calls this to enqueue a delayed job that becomes approvable at run time.
export function scheduleJob(job, runAtISO) {
  job.scheduledFor = runAtISO;
  job.status = 'pending';
  JOBS.upsert(job);
  return job;
}

// Process a single job. Called by worker or scheduler.
async function _process(job) {
  if (job.status !== 'approved') return job;
  // allowlist enforcement in test mode
  if (CFG.TEST_MODE && !_allowed(job)) {
    return _fail(job, `test mode: ${job.to} not in allowlist`);
  }
  if (job.channel === 'sms') {
    if (isOptedOut(job.to)) return _fail(job, 'recipient opted out (STOP)');
    const r = await sendSms({ to: job.to, body: job.body });
    return _apply(job, r);
  }
  if (job.channel === 'email') {
    const r = await sendEmail({ to: job.to, subject: job.subject, body: job.body });
    return _apply(job, r);
  }
  return _fail(job, `unknown channel ${job.channel}`);
}

function _apply(job, r) {
  if (r.ok) {
    job.externalId = r.sid || r.emailId || '';
    job.status = r.simulated ? 'simulated' : 'sent';
    job.lastError = '';
  } else {
    return _retryOrFail(job, r.error || 'send failed');
  }
  job.updatedAt = nowISO();
  JOBS.upsert(job);
  return job;
}

function _retryOrFail(job, err) {
  job.attempts += 1;
  job.lastError = String(err);
  if (job.attempts < MAX_RETRIES) {
    job.status = 'approved'; // stay queued for retry
    job.scheduledFor = new Date(Date.now() + RETRY_BACKOFF_MS[job.attempts - 1] || 60000).toISOString();
  } else {
    job.status = 'failed';
  }
  job.updatedAt = nowISO();
  JOBS.upsert(job);
  return job;
}

function _fail(job, err) {
  job.status = 'failed';
  job.lastError = String(err);
  job.updatedAt = nowISO();
  JOBS.upsert(job);
  return job;
}

function _setStatus(jobId, status) {
  const j = JOBS.byId(jobId);
  if (!j) return null;
  j.status = status;
  j.updatedAt = nowISO();
  JOBS.upsert(j);
  return j;
}

function _allowed(job) {
  if (job.channel === 'sms') {
    if (CFG.TEST_PHONE_ALLOWLIST.length && !CFG.TEST_PHONE_ALLOWLIST.includes(job.to)) return false;
    return true;
  }
  if (job.channel === 'email') {
    if (CFG.TEST_EMAIL_ALLOWLIST.length && !CFG.TEST_EMAIL_ALLOWLIST.includes(job.to)) return false;
    return true;
  }
  return true;
}

// ---- Worker loop (survives restart: re-processes approved/due jobs) ----
let _timer = null;
export function startWorker() {
  if (_timer) return;
  _timer = setInterval(async () => {
    const now = Date.now();
    const due = JOBS.all().filter(j =>
      j.status === 'approved' &&
      (!j.scheduledFor || new Date(j.scheduledFor).getTime() <= now)
    );
    for (const job of due) {
      try { await _process(job); } catch (e) { _fail(job, String(e)); }
    }
  }, (CFG.AUTOMATION_POLL_SECONDS || 5) * 1000);
  if (typeof _timer.unref === 'function') _timer.unref();
}

// Mark delivered (called by webhooks on delivery callback)
export function markDelivered(jobId, externalId) {
  const j = JOBS.byId(jobId);
  if (!j) return null;
  if (j.externalId && externalId && j.externalId !== externalId) return j;
  j.status = 'delivered';
  j.updatedAt = nowISO();
  JOBS.upsert(j);
  return j;
}
