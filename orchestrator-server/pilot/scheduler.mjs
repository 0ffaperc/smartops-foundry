// pilot/scheduler.mjs — Persistent scheduler for delayed follow-ups.
// Survives server restarts (jobs stored in 'schedule' collection + engine jobs).
// On a customer reply, scheduled follow-ups for that lead are cancelled.
import { collection, nowISO, uid } from './store.mjs';
import { CFG } from './env.mjs';
import { createJob, cancel as cancelJob, listJobs } from './engine.mjs';
import { draftMessage } from './ai.mjs';

const SCHED = collection('schedule');

// Schedule a follow-up for a lead. Returns the scheduled item.
// kind: 'sms' | 'email'. minutesFromNow controls the delay (uses TEST_FOLLOWUP_MINUTES default).
export async function scheduleFollowup({ leadId, contact, business, kind = 'sms', automationType = 'no_show_followup', minutesFromNow, context }) {
  const mins = minutesFromNow ?? CFG.TEST_FOLLOWUP_MINUTES;
  const runAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
  // draft the follow-up content now (so approval can happen before send)
  const drafted = await draftMessage({ business, contact, automationType, context });
  const content = drafted.__error ? { body: `Hi {{contact_name}}, following up on your recent inquiry. — ${business?.name || 'us'}` } : drafted;
  // create a pending job gated by scheduledFor
  const job = createJob({
    draftId: 'followup-' + uid(),
    leadId,
    channel: kind,
    to: kind === 'sms' ? contact.phone : contact.email,
    subject: content.subject || '',
    body: content.body || '',
    businessName: business?.name || '',
  });
  job.scheduledFor = runAt;
  // follow-ups still need approval (manual gate). They stay 'pending' until approved.
  const item = {
    id: uid(),
    leadId,
    jobId: job.id,
    channel: kind,
    runAt,
    status: 'scheduled',
    createdAt: nowISO(),
  };
  SCHED.upsert(item);
  return item;
}

export function listSchedule(filter = {}) {
  let list = SCHED.all();
  if (filter.leadId) list = list.filter(s => s.leadId === filter.leadId);
  if (filter.status) list = list.filter(s => s.status === filter.status);
  return list.sort((a, b) => (a.runAt || '').localeCompare(b.runAt || ''));
}

// Cancel all scheduled follow-ups for a lead (e.g. customer replied).
export function cancelForLead(leadId) {
  const items = SCHED.filter(s => s.leadId === leadId && s.status === 'scheduled');
  for (const it of items) {
    it.status = 'cancelled';
    SCHED.upsert(it);
    cancelJob(it.jobId); // engine job → cancelled (if still pending/approved)
  }
  return items.length;
}

export function schedulerStatus() {
  const all = SCHED.all();
  return {
    total: all.length,
    scheduled: all.filter(s => s.status === 'scheduled').length,
    cancelled: all.filter(s => s.status === 'cancelled').length,
    pollSeconds: CFG.AUTOMATION_POLL_SECONDS,
    testFollowupMinutes: CFG.TEST_FOLLOWUP_MINUTES,
    timezone: CFG.DEFAULT_TIMEZONE,
  };
}
