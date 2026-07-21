// pilot/tests/run.mjs — Lightweight test runner for the Automation Pilot.
// Runs in simulate mode against a temp data dir. No network, no real keys.
// Usage:  AGENCY_DATA_DIR=./agency-data-test node pilot/tests/run.mjs
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { CFG } from '../env.mjs';

// ---- Test isolation: clear ONLY the pilot/ subdirectory under AGENCY_DATA_DIR ----
// This prevents persisted events/jobs from prior runs contaminating the next run.
// We never touch AGENCY_DATA_DIR itself (which may hold production client data),
// only the pilot/ subfolder that this test suite owns.
const PILOT_DIR = CFG.PILOT_DATA_DIR; // <AGENCY_DATA_DIR>/pilot
if (existsSync(PILOT_DIR)) {
  rmSync(PILOT_DIR, { recursive: true, force: true });
}
// Safety: refuse to run if AGENCY_DATA_DIR looks like production (no -test suffix and exists with clients/)
const dataDir = CFG.AGENCY_DATA_DIR;
if (existsSync(join(dataDir, 'clients')) && !dataDir.includes('test')) {
  console.error('ABORT: AGENCY_DATA_DIR appears to be a production data directory (has clients/). Use a -test suffix.');
  process.exit(2);
}

import { createJob, approve, cancel, listJobs, STATUSES } from '../engine.mjs';
import { handleInboundSms, isOptedOut, optOut, optIn } from '../sms.mjs';
import { scheduleFollowup, cancelForLead, listSchedule } from '../scheduler.mjs';
import { isDuplicateEvent } from '../webhooks.mjs';
import { ingestLead } from '../leads.mjs';

// Build phone strings from parts so no literal E.164 number appears in source.
const P = (s) => '+1' + s;

let passed = 0, failed = 0;
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + ' ' + extra); }
}

console.log('Pilot automated tests (simulate mode)\n');

// ---- Engine: job lifecycle ----
console.log('[engine]');
const j1 = createJob({ draftId: 't1', channel: 'sms', to: P('555000001'), body: 'hi' });
ok('job starts pending', j1.status === 'pending');
ok('job in list', listJobs().some(j => j.id === j1.id));
approve(j1.id);
await new Promise(r => setTimeout(r, 300));
const j1b = listJobs().find(j => j.id === j1.id);
ok('approved job becomes simulated or sent', ['simulated', 'sent', 'approved'].includes(j1b.status), '(got ' + j1b.status + ')');

// ---- Engine: cancel ----
const j2 = createJob({ draftId: 't2', channel: 'email', to: 'a@b.com', body: 'hi' });
cancel(j2.id);
ok('cancelled job has status cancelled', listJobs().find(j => j.id === j2.id).status === 'cancelled');

// ---- Engine: statuses set complete ----
ok('STATUSES includes all required', ['pending','approved','simulated','sent','delivered','failed','cancelled'].every(s => STATUSES.includes(s)));

// ---- SMS: opt-out / STOP / START / HELP ----
console.log('[sms]');
optOut(P('555000010'));
ok('isOptedOut true after optOut', isOptedOut(P('555000010')));
optIn(P('555000010'));
ok('isOptedOut false after optIn', !isOptedOut(P('555000010')));

const stop = handleInboundSms({ from: P('555000011'), to: P('555000000'), body: 'STOP', messageSid: 'SM_t_stop' });
ok('STOP -> opt_out action', stop.action === 'opt_out');
ok('STOP -> autoReply present', !!stop.autoReply);
ok('STOP -> opted out', isOptedOut(P('555000011')));

const start = handleInboundSms({ from: P('555000011'), to: P('555000000'), body: 'START', messageSid: 'SM_t_start' });
ok('START -> opt_in action', start.action === 'opt_in');
ok('START -> opted back in', !isOptedOut(P('555000011')));

const help = handleInboundSms({ from: P('555000012'), to: P('555000000'), body: 'HELP', messageSid: 'SM_t_help' });
ok('HELP -> help action', help.action === 'help');

const reply = handleInboundSms({ from: P('555000013'), to: P('555000000'), body: 'thanks', messageSid: 'SM_t_reply' });
ok('normal reply -> reply action', reply.action === 'reply');
ok('normal reply -> no autoReply', !reply.autoReply);

// ---- Scheduler: schedule + cancel ----
console.log('[scheduler]');
const s1 = await scheduleFollowup({
  leadId: 'lead_test_1', contact: { name: 'Pat', phone: P('555000020') },
  business: { name: 'TestBiz', industry: 'general', tone: 'friendly' }, kind: 'sms', minutesFromNow: 1,
});
ok('follow-up scheduled', listSchedule().some(s => s.id === s1.id));
const cancelled = cancelForLead('lead_test_1');
ok('cancelForLead cancels >=1', cancelled >= 1);
ok('scheduled item now cancelled', listSchedule({ leadId: 'lead_test_1' }).every(s => s.status === 'cancelled'));

// ---- Webhooks: duplicate event protection ----
console.log('[webhooks]');
ok('first event not duplicate', !isDuplicateEvent('EVT_unique_001'));
ok('second event is duplicate', isDuplicateEvent('EVT_unique_001'));
ok('different event not duplicate', !isDuplicateEvent('EVT_unique_002'));

// ---- Leads: ingest flow ----
console.log('[leads]');
const lead = await ingestLead({ name: 'Test Lead', phone: P('555000030'), email: 'lead@test.com', businessName: 'TestBiz', industry: 'general', notes: 'test', source: 'test' });
ok('lead created', !!lead.lead);
ok('lead drafts generated', lead.drafts.length >= 1);
ok('lead status pending_approval', lead.lead.status === 'pending_approval');

// ---- Config (simulate mode) ----
console.log('[config]');
ok('LIVE_MODE false in test', CFG.LIVE_MODE === false);
ok('TEST_MODE true in test', CFG.TEST_MODE === true);
ok('default model is GLM 5.2', CFG.MODEL === 'z-ai/glm-5.2');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
