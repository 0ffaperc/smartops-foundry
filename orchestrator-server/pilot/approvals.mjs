// pilot/approvals.mjs — Draft approval workflow.
// Draft: pending → approved | rejected | edited. Only approved drafts enqueue an engine job.
import { collection, nowISO, uid } from './store.mjs';
import { createJob, approve as approveJob, getJob, listJobs } from './engine.mjs';
import { afterLeadSent } from './leads.mjs';

const DRAFTS = collection('drafts');

export function createDraft({ leadId, channel, to, subject, body }) {
  const d = {
    id: uid(),
    leadId,
    channel,        // 'sms' | 'email'
    to,
    subject: subject || '',
    body,
    status: 'pending',   // pending | approved | rejected
    jobId: '',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  DRAFTS.upsert(d);
  return d;
}

export function getDraft(id) { return DRAFTS.byId(id); }
export function listDrafts(filter = {}) {
  let list = DRAFTS.all();
  if (filter.status) list = list.filter(d => d.status === filter.status);
  if (filter.leadId) list = list.filter(d => d.leadId === filter.leadId);
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function editDraft(id, patch) {
  const d = DRAFTS.byId(id);
  if (!d) return null;
  if (d.status === 'approved') return null; // can't edit after approval
  if (patch.body !== undefined) d.body = patch.body;
  if (patch.subject !== undefined) d.subject = patch.subject;
  if (patch.to !== undefined) d.to = patch.to;
  d.updatedAt = nowISO();
  DRAFTS.upsert(d);
  return d;
}

export async function approveDraft(id) {
  const d = DRAFTS.byId(id);
  if (!d) return null;
  if (d.status !== 'pending') return d;
  // create engine job + approve it for immediate processing
  const job = createJob({ draftId: d.id, leadId: d.leadId, channel: d.channel, to: d.to, subject: d.subject, body: d.body });
  approveJob(job.id);
  d.status = 'approved';
  d.jobId = job.id;
  d.updatedAt = nowISO();
  DRAFTS.upsert(d);
  // schedule follow-up for the lead after the first send
  if (d.leadId) { try { await afterLeadSent(d.leadId); } catch {} }
  return d;
}

export async function rejectDraft(id) {
  const d = DRAFTS.byId(id);
  if (!d) return null;
  if (d.status === 'approved') return d; // already sent/in-flight
  d.status = 'rejected';
  d.updatedAt = nowISO();
  DRAFTS.upsert(d);
  if (d.jobId) {
    const { cancel } = await import('./engine.mjs');
    cancel(d.jobId);
  }
  return d;
}
