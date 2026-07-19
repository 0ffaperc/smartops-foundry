// pilot/leads.mjs — Lead CRUD + website lead flow.
// Flow: lead created → AI drafts SMS + email → stored as pending drafts →
// (approval) → engine sends → scheduler schedules follow-up → cancel on reply.
import { collection, nowISO, uid } from './store.mjs';
import { draftMessage } from './ai.mjs';
import { createDraft } from './approvals.mjs';
import { scheduleFollowup, cancelForLead } from './scheduler.mjs';
import { isOptedOut } from './sms.mjs';

const LEADS = collection('leads');

export function createLead({ name, phone, email, source = 'website_form', businessName = 'Your Business', industry = 'general', notes = '' }) {
  if (!name && !phone && !email) throw new Error('lead requires at least a name, phone, or email');
  const lead = {
    id: uid(),
    name: name || '',
    phone: phone || '',
    email: email || '',
    source,
    businessName,
    industry,
    notes,
    status: 'new',           // new → drafting → pending_approval → contacted → replied
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  LEADS.upsert(lead);
  return lead;
}

export function getLead(id) { return LEADS.byId(id); }
export function listLeads(filter = {}) {
  let list = LEADS.all();
  if (filter.status) list = list.filter(l => l.status === filter.status);
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
export function updateLead(id, patch) {
  const l = LEADS.byId(id);
  if (!l) return null;
  Object.assign(l, patch, { updatedAt: nowISO() });
  LEADS.upsert(l);
  return l;
}

// Mark a lead as replied (incoming SMS from their phone) → cancel scheduled follow-ups.
// Compares digits-only so a '+' that got URL-decoded to a space still matches.
export function markReplied(phone) {
  const norm = String(phone || '').replace(/[^\d]/g, '');
  const lead = LEADS.all().find(l => String(l.phone || '').replace(/[^\d]/g, '') === norm && norm.length >= 7);
  if (lead) {
    lead.status = 'replied';
    lead.updatedAt = nowISO();
    LEADS.upsert(lead);
    cancelForLead(lead.id);
    return lead;
  }
  return null;
}

// ---- The full website lead flow: create + AI draft SMS + email ----
// Returns the lead + created drafts. Drafts stay 'pending' for manual approval.
export async function ingestLead({ name, phone, email, businessName, industry, notes, source }) {
  const lead = createLead({ name, phone, email, source, businessName, industry, notes });
  const contact = { name: lead.name, phone: lead.phone, email: lead.email, tags: [lead.source], notes: lead.notes };
  const business = { name: businessName || lead.businessName, industry: industry || lead.industry, tone: 'friendly' };

  const drafts = [];
  if (lead.phone && !isOptedOut(lead.phone)) {
    const drafted = await draftMessage({ business, contact, automationType: 'lead_welcome', context: { lead_id: lead.id } });
    if (!drafted.__error) {
      drafts.push(createDraft({ leadId: lead.id, channel: 'sms', to: lead.phone, subject: '', body: drafted.body }));
    }
  }
  if (lead.email) {
    const drafted = await draftMessage({ business, contact, automationType: 'newsletter', context: { lead_id: lead.id } });
    if (!drafted.__error) {
      drafts.push(createDraft({ leadId: lead.id, channel: 'email', to: lead.email, subject: drafted.subject || `Welcome from ${business.name}`, body: drafted.body }));
    }
  }
  lead.status = 'pending_approval';
  lead.updatedAt = nowISO();
  LEADS.upsert(lead);
  return { lead, drafts };
}

// On approve of all drafts → schedule follow-up. Called by approvals.mjs after send.
export async function afterLeadSent(leadId) {
  const lead = LEADS.byId(leadId);
  if (!lead) return null;
  lead.status = 'contacted';
  lead.updatedAt = nowISO();
  LEADS.upsert(lead);
  // schedule an SMS follow-up (in test mode, short delay via TEST_FOLLOWUP_MINUTES)
  const contact = { name: lead.name, phone: lead.phone, email: lead.email, tags: [lead.source], notes: lead.notes };
  const business = { name: lead.businessName, industry: lead.industry, tone: 'friendly' };
  if (lead.phone && !isOptedOut(lead.phone)) {
    return await scheduleFollowup({ leadId, contact, business, kind: 'sms', automationType: 'quote_followup' });
  } else if (lead.email) {
    return await scheduleFollowup({ leadId, contact, business, kind: 'email', automationType: 'winback' });
  }
  return null;
}
