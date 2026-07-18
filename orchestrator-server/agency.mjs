// agency.mjs — Multi-tenant AI Agency Automation Engine
// Each client (business) gets: profile, contacts, automations, messages, templates.
// SMS via Twilio, Email via SMTP. Preview-first + approval gate before any real send.
// AI (GLM 5.2) drafts personalized messages per client/contact/automation-type.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const AGENCY_DIR = 'C:/Users/shahe/AppData/Local/hermes/agency-data';
const CLIENTS_DIR = join(AGENCY_DIR, 'clients');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_KEY = process.env.OPENROUTER_API_KEY || '';
const FAST_MODEL = process.env.LIFEOS_FAST_MODEL || 'z-ai/glm-5.2';

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function readJSON(p, fallback) { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : fallback; } catch { return fallback; } }
function writeJSON(p, data) { ensureDir(join(p, '..')); writeFileSync(p, JSON.stringify(data, null, 2)); }
function cid(name) { return (name||'client').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32) + '-' + Date.now().toString(36).slice(-4); }
function nowISO() { return new Date().toISOString(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

ensureDir(CLIENTS_DIR);

// ---- Automation type catalog (the "menu" of services the agency sells) ----
const AUTOMATION_CATALOG = {
  missed_call:     { name: 'Missed Call Text-Back',       channel: 'sms',   trigger: 'missed_call',         desc: 'Instant SMS when a call is missed. AI classifies urgency + drafts reply.' },
  lead_welcome:    { name: 'New Lead Welcome',            channel: 'both',  trigger: 'new_lead',            desc: 'Welcome SMS + email to new leads with next steps.' },
  appt_reminder:   { name: 'Appointment Reminder',       channel: 'sms',   trigger: 'before_appt',         desc: 'SMS reminder 24h before appointment. Reduces no-shows.' },
  no_show:         { name: 'No-Show Follow-Up',          channel: 'sms',   trigger: 'after_no_show',       desc: 'SMS after a missed appointment offering to rebook.' },
  quote_followup:  { name: 'Quote Follow-Up Sequence',   channel: 'sms',   trigger: 'cold_quote',          desc: '3-touch SMS sequence for quotes that go cold (2, 5, 9 days).' },
  review_request:  { name: 'Review Request',              channel: 'sms',   trigger: 'after_job_complete',  desc: 'SMS 2 days after job completion asking for a Google review.' },
  re_engagement:   { name: 'Dormant Customer Re-Engage', channel: 'email', trigger: 'dormant_customer',    desc: "Email to customers who haven't booked in 90+ days with a win-back offer." },
  birthday:        { name: 'Birthday Message',           channel: 'sms',   trigger: 'birthday',            desc: 'Personalized birthday SMS with optional discount.' },
  newsletter:      { name: 'Monthly Email Newsletter',    channel: 'email', trigger: 'monthly',             desc: 'AI-generated monthly email with tips, updates, and offers.' },
  winback:         { name: 'Win-Back Campaign',           channel: 'email', trigger: 'lost_customer',       desc: 'Email sequence to lost customers with a compelling offer.' },

  // ---- Marketing & Reputation (the growth tier) ----
  review_response: { name: 'Google Review Response',       channel: 'email', trigger: 'new_review',         desc: 'AI auto-drafts on-brand replies to every Google review (positive + negative) for approval. Keeps GBP active + boosts local SEO.' },
  referral_request:{ name: 'Referral Request',            channel: 'sms',   trigger: 'after_job_complete', desc: 'SMS asking happy customers for a referral (friend/family) with a mutual discount code. Cheapest new-lead source.' },
  social_post:     { name: 'Social Media Post Generator', channel: 'none',  trigger: 'weekly',             desc: 'AI generates 3 platform-ready posts/week (Facebook + Instagram) with caption, hashtags, + image idea. Auto-saves for approval.' },
  gbp_update:      { name: 'Google Business Profile Posts',channel:'none',  trigger: 'weekly',             desc: 'AI writes + schedules weekly GBP "What\'s New" posts (offers, tips, updates) to boost map-pack visibility.' },
  seasonal_campaign:{name:'Seasonal Promo Campaign',       channel: 'both',  trigger: 'seasonal',           desc: 'Time-aware SMS+email blasts for seasonal demand (spring AC tune-up, fall furnace check, winter emergency). AI picks the angle.' },

  // ---- Sales Pipeline ----
  nurture_sequence:{ name: 'Cold Lead Nurture Sequence',   channel: 'sms',   trigger: 'cold_lead',          desc: '5-touch SMS sequence over 14 days: value → social proof → offer → urgency → final. Wakes up leads that went cold.' },
  upsell:          { name: 'Post-Job Upsell',             channel: 'sms',   trigger: 'after_job_complete',  desc: 'SMS 3 days after a job offering a relevant add-on (e.g. "AC fixed — want a $79 system tune-up?"). Increases LTV.' },
  estimate_followup:{name: 'Estimate Follow-Up',           channel: 'sms',   trigger: 'estimate_sent',       desc: 'SMS 1 hour after an estimate is sent: "Did you get the quote? Any questions?" Catches leads before they shop competitors.' },

  // ---- Customer Service ----
  faq_responder:   { name: 'FAQ Auto-Responder',          channel: 'sms',   trigger: 'inbound_question',    desc: 'AI answers common SMS questions (hours, pricing, services, service area) instantly from a client FAQ knowledge base. Escalates complex ones.' },
  thank_you:       { name: 'Post-Service Thank You',       channel: 'sms',   trigger: 'after_job_complete',  desc: 'SMS same-day thank you after a completed job + soft review/referral ask. Builds loyalty + drives reviews.' },

  // ---- Reporting & Intelligence ----
  weekly_report:   { name: 'Weekly Performance Summary',  channel: 'email', trigger: 'weekly',             desc: 'Email to the business owner every Monday: leads, bookings, revenue, response times, review count, pipeline value. Proves ROI.' },
  missed_revenue:  { name: 'Missed Revenue Alert',         channel: 'sms',   trigger: 'missed_opportunity',  desc: 'Real-time SMS to owner when a lead goes cold / quote expires / no-shows, with the dollar value + 1-tap recovery action.' },

  // ---- Call Automation ----
  call_script:     { name: 'AI Call Script Generator',     channel: 'none',  trigger: 'before_call',        desc: 'AI drafts a personalized call script (opening, key points, objection handling, closing) for outbound follow-up calls. Owner reads it on the call.' },
  voicemail_followup:{name: 'Voicemail Follow-Up',         channel: 'sms',   trigger: 'after_voicemail',    desc: 'SMS immediately after a call goes to voicemail: "Just called about your AC — left a VM. Here is my direct line if easier." Doubles callback rate.' },
  scheduled_call:  { name: 'Scheduled Call Reminder',      channel: 'sms',   trigger: 'before_call',        desc: 'SMS 1 hour before a scheduled outbound call to the owner with the lead name, context, and AI call script attached.' },
  inbound_call_log:{ name: 'Inbound Call Summary',         channel: 'email', trigger: 'after_call',         desc: 'After an inbound call, AI summarizes the conversation, extracts the lead need + urgency, and drafts a follow-up SMS for approval.' },

  // ---- Marketing Campaigns ----
  multi_channel_campaign:{name:'Multi-Channel Campaign',   channel: 'both',  trigger: 'campaign_launch',    desc: 'Coordinated SMS + email + social campaign for a promotion (e.g. spring tune-up). AI writes all assets in one batch for a consistent message across channels.' },
  content_calendar:{ name: 'Monthly Content Calendar',     channel: 'none',  trigger: 'monthly',            desc: 'AI generates a 30-day content calendar: post ideas, captions, hashtags, best posting times for Facebook + Instagram. Saves for approval.' },
  ad_copy:         { name: 'Google/Meta Ad Copy',          channel: 'none',  trigger: 'campaign_launch',    desc: 'AI writes 3 ad copy variations (headline + description + CTA) for Google Ads or Meta Ads, optimized for the business niche + target keyword.' },
  offer_promo:     { name: 'Promo Offer Generator',        channel: 'both',  trigger: 'seasonal',           desc: 'AI designs a limited-time promo (discount %, urgency hook, expiry) + writes the SMS + email to announce it. Drives immediate bookings.' },
};

// ---- OpenRouter direct call (AI message drafting) ----
async function aiDraft(systemPrompt, userMessage, maxTokens = 600) {
  const body = { model: FAST_MODEL, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], max_tokens: maxTokens, temperature: 0.8 };
  const r = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OR_KEY, 'HTTP-Referer': 'http://localhost:8787', 'X-Title': 'LifeOS Agency' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

// ---- Client CRUD ----
function listClients() {
  const regPath = join(AGENCY_DIR, 'clients.json');
  let reg = readJSON(regPath, []);
  // Ensure per-client dirs exist + sync registry
  if (existsSync(CLIENTS_DIR)) {
    for (const d of readdirSync(CLIENTS_DIR)) {
      const profPath = join(CLIENTS_DIR, d, 'profile.json');
      if (existsSync(profPath)) {
        const prof = readJSON(profPath, null);
        if (prof && !reg.find(c => c.id === prof.id)) {
          reg.push({ id: prof.id, name: prof.name, industry: prof.industry, status: prof.status || 'active', created: prof.created });
        }
      }
    }
  }
  reg.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  writeJSON(regPath, reg);
  return reg;
}

function getClient(id) {
  const dir = join(CLIENTS_DIR, id);
  if (!existsSync(dir)) return null;
  return {
    profile: readJSON(join(dir, 'profile.json'), null),
    contacts: readJSON(join(dir, 'contacts.json'), []),
    automations: readJSON(join(dir, 'automations.json'), []),
    templates: readJSON(join(dir, 'templates.json'), []),
    messages: readJSON(join(dir, 'messages.json'), []),
  };
}

function createClient(profile) {
  const id = cid(profile.name || 'client');
  const dir = join(CLIENTS_DIR, id);
  ensureDir(dir);
  const full = {
    id,
    name: profile.name || 'Untitled Business',
    industry: profile.industry || 'general',
    phone: profile.phone || '',
    email: profile.email || '',
    address: profile.address || '',
    branding: profile.branding || { primaryColor: '#3b82f6', tone: 'friendly' },
    smsProvider: profile.smsProvider || { type: 'twilio', sid: '', token: '', fromNumber: '' },
    emailProvider: profile.emailProvider || { type: 'smtp', host: '', port: 587, user: '', pass: '', from: '' },
    status: 'active',
    created: nowISO(),
  };
  writeJSON(join(dir, 'profile.json'), full);
  writeJSON(join(dir, 'contacts.json'), []);
  writeJSON(join(dir, 'automations.json'), []);
  writeJSON(join(dir, 'templates.json'), defaultTemplates(full));
  writeJSON(join(dir, 'messages.json'), []);
  listClients(); // sync registry
  return { id, profile: full };
}

function updateClient(id, updates) {
  const dir = join(CLIENTS_DIR, id);
  const profPath = join(dir, 'profile.json');
  if (!existsSync(profPath)) return null;
  const prof = readJSON(profPath, null);
  const merged = { ...prof, ...updates, id };
  writeJSON(profPath, merged);
  return merged;
}

function deleteClient(id) {
  const dir = join(CLIENTS_DIR, id);
  if (!existsSync(dir)) return false;
  for (const f of readdirSync(dir)) unlinkSync(join(dir, f));
  try { unlinkSync(dir); } catch {}
  // remove from registry
  const reg = listClients().filter(c => c.id !== id);
  writeJSON(join(AGENCY_DIR, 'clients.json'), reg);
  return true;
}

function defaultTemplates(client) {
  const name = client.name;
  return [
    { id: uid(), name: 'Missed Call Text-Back', channel: 'sms', body: `Hi {{contact_name}}, this is ${name}. Sorry we missed your call! How can we help you today?` },
    { id: uid(), name: 'Appointment Reminder', channel: 'sms', body: `Hi {{contact_name}}, reminder: your appointment with ${name} is tomorrow. Reply Y to confirm or call to reschedule.` },
    { id: uid(), name: 'Review Request', channel: 'sms', body: `Hi {{contact_name}}, thanks for choosing ${name}! Could you take 30 seconds to leave us a review? {{review_link}}` },
    { id: uid(), name: 'Welcome Email', channel: 'email', subject: `Welcome to ${name}!`, body: `Hi {{contact_name}},\n\nThanks for reaching out to ${name}. We've got you covered.\n\nBest,\nThe ${name} Team` },
  ];
}

export {
  AGENCY_DIR, CLIENTS_DIR, AUTOMATION_CATALOG,
  listClients, getClient, createClient, updateClient, deleteClient,
  readJSON, writeJSON, ensureDir, join, uid, nowISO, aiDraft,
};
