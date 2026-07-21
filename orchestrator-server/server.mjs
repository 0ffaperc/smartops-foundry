// LifeOS V2 — Hermes Orchestrator Backend (Hybrid)
// Runs on http://localhost:8787 with zero external dependencies (Node built-ins only).
//
// TWO paths, auto-selected by task:
//   - coach mode (daily briefs/planning) -> DIRECT OpenRouter call. Fast (~3-6s).
//     Your LifeOS tasks/goals are the context, passed in every time. No agent boot.
//   - site mode  (app/code changes)      -> FULL Hermes agent (memory, web, tools).
//     Slower (~30s) but powerful — used only when you're building/editing the app.
//
// Low-credit safety net forces the cheapest model regardless of mode.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join as pathJoin, dirname } from 'node:path';
// Stage 3B: auth module — cookie sessions, scrypt hashing, rate limiting, CORS
import { attachAuth, requireAuth, applyCORS, readBodyWithLimit, readRawWithLimit, BodyTooLargeError, handleAuthRoutes, MAX_BODY_BYTES, pruneExpiredSessions } from './auth/index.mjs';
import { createHash, randomBytes, createHmac } from 'node:crypto';

const PORT = 8787;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

// ---- Models ----------------------------------------------------------------
const FAST_MODEL  = process.env.LIFEOS_FAST_MODEL  || 'z-ai/glm-5.2';                  // GLM 5.2 — brain: reasoning + 1M context
const SMART_MODEL = process.env.LIFEOS_SMART_MODEL || 'moonshotai/kimi-k2.7-code';     // Kimi K2.7 Code — hands: agentic code
const CHEAP_MODEL = process.env.LIFEOS_CHEAP_MODEL || 'deepseek/deepseek-chat';        // emergency low-credit fallback
const LOW_CREDIT  = process.env.LIFEOS_LOW_CREDIT === '1';

function pickModel(mode) {
  if (LOW_CREDIT) return CHEAP_MODEL;
  if (mode === 'site') return SMART_MODEL;
  return FAST_MODEL;
}

// Hermes binary — configurable via env. Default to PATH lookup ('hermes').
const HERMES = process.env.HERMES_BIN || 'hermes';

// ---- LifeOS context --------------------------------------------------------
function buildContext(appState = {}, today) {
  const { goals = [], tasks = [], habits = [], habitLogs = [], reviews = [] } = appState;
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 15);
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped').slice(0, 25);
  const todayTasks = tasks.filter((t) => t.date === today);
  const activeHabits = habits.filter((h) => h.active);
  const habitsDone = habitLogs.filter((l) => l.date === today && l.completed).length;
  const recentReviews = [...reviews].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);

  const lines = [];
  lines.push(`Today: ${today}`);
  lines.push(`\nACTIVE GOALS (${activeGoals.length}):`);
  activeGoals.forEach((g) => lines.push(`  - [${g.level || '?'}] ${g.title}${g.deadline ? ` (due ${g.deadline})` : ''}`));
  lines.push(`\nOPEN TASKS (${openTasks.length} shown):`);
  openTasks.forEach((t) => lines.push(`  - ${t.title} [${t.priority || 'normal'}${t.date ? `, ${t.date}` : ''}]`));
  lines.push(`\nTODAY: ${todayTasks.filter((t) => t.status === 'done').length}/${todayTasks.length} tasks done · ${habitsDone}/${activeHabits.length} habits logged`);
  if (recentReviews.length) {
    lines.push(`\nRECENT REVIEWS:`);
    recentReviews.forEach((r) => lines.push(`  - ${r.date}: mood ${r.mood ?? '?'}, focus: ${r.tomorrowFocus || '-'}`));
  }
  return lines.join('\n');
}

function buildSystemPrompt(mode) {
  const modeNote = mode === 'site'
    ? 'The user wants an app/feature change. Give exact, builder-ready implementation steps and file names. Use TASK: lines for action items.'
    : "Be the user's command-center coach. Decide the single highest-leverage next action and keep them moving toward their goals.";
  return `You are the LifeOS Orchestrator Agent (Perc Jr.) — Sir Perc's head agent, sitting above his planner, tasks, habits, goals, and reviews.

Rules:
1. Start with the decision/recommendation.
2. Brief reason.
3. Next 3-7 concrete actions.
4. Output action items as lines starting with "TASK:" so LifeOS can convert them into real tasks.
5. Be direct, practical, outcome-focused. No flattery, no vagueness. Keep it tight.

${modeNote}`;
}

function cleanReply(s) {
  return (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- FAST PATH: direct OpenRouter call (coach mode) ------------------------
async function callOpenRouterDirect({ model, systemPrompt, context, userMessage, maxTokens }) {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set in environment');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lifeos.local',
      'X-Title': 'LifeOS V2 Orchestrator',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: maxTokens || 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `=== LIVE LIFEOS CONTEXT ===\n${context}\n=== END CONTEXT ===\n\n${userMessage}` },
      ],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter ${res.status}`);
  const content = data?.choices?.[0]?.message?.content;
  // GLM 5.2 reasoning model: if content is null, extract from reasoning
  if (!content) {
    const reasoning = data?.choices?.[0]?.message?.reasoning;
    if (reasoning) {
      // Try to extract the actual message from reasoning — look for quoted text or last line
      // The reasoning often ends with the answer after analysis
      const lines = reasoning.trim().split('\n').filter(l => l.trim());
      // If reasoning has a clear output section, use it; otherwise use the whole reasoning
      return cleanReply(reasoning.trim());
    }
    throw new Error('Empty OpenRouter reply');
  }
  return cleanReply(content);
}

// ---- POWER PATH: full Hermes agent (site/code mode) ------------------------
function callHermes({ model, systemPrompt, context, userMessage }) {
  return new Promise((resolve, reject) => {
    const prompt = `${systemPrompt}\n\n=== LIVE LIFEOS CONTEXT ===\n${context}\n=== END CONTEXT ===\n\nUser: ${userMessage}`;
    const args = ['chat', '-q', prompt, '-m', model, '--provider', 'openrouter', '-t', 'web,todo,file', '-Q'];
    const child = spawn(HERMES, args, { shell: false });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Hermes timed out after 180s')); }, 180000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) reject(new Error(err.trim() || `Hermes exited ${code}`));
      else resolve(cleanReply(out));
    });
  });
}

// ---- HTTP plumbing ---------------------------------------------------------
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

// ---- Clip Builder helpers ------------------------------------------------
// Runs a CLI command and resolves { stdout, stderr, exitCode }. Timeout in ms.
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(opts.env || {}) };
    const child = spawn(cmd, args, { shell: false, cwd: opts.cwd, env });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); resolve({ stdout: out, stderr: 'Timeout', exitCode: 124 }); }, opts.timeout || 90000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ stdout: '', stderr: String(e), exitCode: -1 }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout: out, stderr: err, exitCode: code }); });
  });
}

// Official accounts to exclude from viral scan
const CLIP_OFFICIAL = ['premierleague','championsleague','uefa','fifa','bbcsport','bbcfootball','skyfootball','skysports','espn','espnfc','tntsports','btsport','goal','brfootball','433','laliga','seriea','bundesliga','ligue1_eng','mls'];
function isOfficialChannel(sn) {
  const s = (sn || '').toLowerCase();
  return CLIP_OFFICIAL.some((o) => s === o || s.includes(o));
}

// Read Twitter creds from agent-reach config (avoids needing env vars in .env)
let _twitterCreds = null;
function getTwitterCreds() {
  if (_twitterCreds) return _twitterCreds;
  try {
    const cfg = readFileSync('C:/Users/shahe/.agent-reach/config.yaml', 'utf-8');
    const authMatch = cfg.match(/twitter_auth_token:\s*(\S+)/);
    const ct0Match = cfg.match(/twitter_ct0:\s*(\S+)/);
    _twitterCreds = {
      TWITTER_AUTH_TOKEN: authMatch ? authMatch[1] : '',
      TWITTER_CT0: ct0Match ? ct0Match[1] : '',
    };
  } catch { _twitterCreds = {}; }
  return _twitterCreds;
}

// Score + rank tweets, return top N
function scoreTweets(tweets, limit = 20) {
  return tweets.map((t) => {
    const m = t.metrics || {};
    const views = parseInt(m.views || 0) || 0;
    const likes = parseInt(m.likes || 0) || 0;
    const bkmk = parseInt(m.bookmarks || 0) || 0;
    const likeRate = views > 0 ? (likes / views) * 100 : 0;
    const bkmkRate = views > 0 ? (bkmk / views) * 100 : 0;
    const official = isOfficialChannel(t.author?.screenName);
    const viralScore = Math.round(views * (1 + likeRate / 10) * (official ? 0.3 : 1));
    return {
      id: t.id,
      text: (t.text || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 200),
      views, likes, retweets: parseInt(m.retweets || 0) || 0,
      bookmarks: bkmk, likeRate: +likeRate.toFixed(1), bkmkRate: +bkmkRate.toFixed(2),
      screenName: t.author?.screenName || '', displayName: t.author?.name || '',
      verified: !!t.author?.verified, official,
      viralScore, createdAt: t.createdAtISO || t.createdAt || '',
      videoUrl: t.media?.[0]?.url || '', lang: t.lang || '',
    };
  }).sort((a, b) => b.viralScore - a.viralScore).slice(0, limit);
}
function send(res, status, obj, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...headers,
  });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  // Stage 3B: attach auth context (req.user) from session cookie on every request
  await attachAuth(req, res);

  if (req.method === 'OPTIONS') {
    const corsHeaders = applyCORS(req, res, { 'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Cookie' });
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, fastModel: FAST_MODEL, smartModel: SMART_MODEL, lowCredit: LOW_CREDIT, hasKey: !!OPENROUTER_KEY });
    return;
  }

  // ---- Auth routes (/api/auth/*) — handled by auth module ----
  const authUrl = new URL(req.url, 'http://localhost');
  if (authUrl.pathname.startsWith('/api/auth/')) {
    const handled = await handleAuthRoutes(req, res, authUrl);
    if (handled) return;
  }

  // ---- Chatbot routes (/api/chat/*) ----
  if (authUrl.pathname.startsWith('/api/chat/')) {
    try {
      let chatBody = null;
      if (req.method === 'POST') {
        try { chatBody = await readBodyWithLimit(req, 256 * 1024); }
        catch (e) {
          if (e instanceof BodyTooLargeError) { send(res, 413, { ok: false, error: 'Body too large' }); return; }
          throw e;
        }
      }
      const { handleChatRoutes } = await import('./chat.mjs');
      const handled = await handleChatRoutes(req, res, authUrl, chatBody);
      if (handled) return;
    } catch (e) {
      send(res, 500, { ok: false, error: 'Chat module error: ' + String(e) });
      return;
    }
  }

  // ---- Automation Pilot (/api/pilot/* and /pilot) ----
  try {
    const { mountPilotRoutes } = await import('./pilot/routes.mjs');
    if (await mountPilotRoutes(req, res)) return;
  } catch (e) {
    // fail open: pilot errors must not break the rest of the server
    if (req.url.startsWith('/api/pilot/') || req.url === '/pilot' || req.url === '/pilot.html') {
      send(res, 500, { ok: false, error: 'pilot module error: ' + String(e) });
      return;
    }
  }

// ---- Agency Ops data (Summit Air demo) ----------------------------------
  // Serves the local CRM + calendar JSON so the AgencyOps screen can render
  // live data without bundling it into the frontend.
  if (req.method === 'GET' && req.url === '/api/agency-data') {
    const AGENCY_DIR = process.env.AGENCY_DATA_DIR || pathJoin(process.cwd(), 'agency-data');
    try {
      const crmPath = pathJoin(AGENCY_DIR, 'summit-air-crm.json');
      const calPath = pathJoin(AGENCY_DIR, 'summit-air-calendar.json');
      const crm = existsSync(crmPath) ? JSON.parse(readFileSync(crmPath, 'utf-8')) : [];
      const calendar = existsSync(calPath) ? JSON.parse(readFileSync(calPath, 'utf-8')) : [];
      send(res, 200, { crm, calendar, source: 'local', client: 'Summit Air HVAC' });
    } catch (e) {
      send(res, 200, { crm: [], calendar: [], error: e.message, source: 'local' });
    }
    return;
  }

  // ---- MULTI-TENANT AGENCY AUTOMATION (unlimited clients, per-client SMS+email) ----
  const agencyUrl = new URL(req.url, 'http://localhost');
  if (agencyUrl.pathname.startsWith('/api/agency/')) {
    // Stage 3B: require authentication for all agency routes
    if (!requireAuth(req, res)) return;
    const agency = await import('./agency.mjs');
    const sendMod = await import('./agency-send.mjs');
    const body = (req.method === 'POST' || req.method === 'PUT') ? await readBodyWithLimit(req) : {};
    const p = agencyUrl.pathname;
    const segs = p.split('/').filter(Boolean); // ['api','agency',...rest]

    // GET /api/agency/catalog — automation type menu
    if (req.method === 'GET' && segs[2] === 'catalog') {
      send(res, 200, { ok: true, catalog: agency.AUTOMATION_CATALOG });
      return;
    }

    // GET /api/agency/clients — list all clients
    if (req.method === 'GET' && segs[2] === 'clients' && segs.length === 3) {
      send(res, 200, { ok: true, clients: agency.listClients() });
      return;
    }
    // POST /api/agency/clients — create new client
    if (req.method === 'POST' && segs[2] === 'clients' && segs.length === 3) {
      const { profile } = body;
      if (!profile?.name) { send(res, 400, { ok: false, error: 'Client name required' }); return; }
      const r = agency.createClient(profile);
      send(res, 200, { ok: true, id: r.id, profile: r.profile });
      return;
    }

    // /api/agency/clients/:id/...
    if (segs[2] === 'clients' && segs[3]) {
      const clientId = segs[3];
      const client = agency.getClient(clientId);
      if (!client) { send(res, 404, { ok: false, error: 'Client not found' }); return; }

      // GET /clients/:id — full client data
      if (req.method === 'GET' && segs.length === 4) {
        send(res, 200, { ok: true, ...client });
        return;
      }
      // PUT /clients/:id — update profile
      if (req.method === 'PUT' && segs.length === 4) {
        const updated = agency.updateClient(clientId, body);
        send(res, 200, { ok: !!updated, profile: updated });
        return;
      }
      // DELETE /clients/:id
      if (req.method === 'DELETE' && segs.length === 4) {
        send(res, 200, { ok: agency.deleteClient(clientId) });
        return;
      }

      // contacts
      if (segs[4] === 'contacts') {
        if (req.method === 'GET') { send(res, 200, { ok: true, contacts: sendMod.listContacts(clientId) }); return; }
        if (req.method === 'POST') { send(res, 200, { ok: true, contact: sendMod.addContact(clientId, body) }); return; }
        if (req.method === 'PUT' && segs[5]) { send(res, 200, { ok: true, contact: sendMod.updateContact(clientId, segs[5], body) }); return; }
        if (req.method === 'DELETE' && segs[5]) { send(res, 200, { ok: sendMod.deleteContact(clientId, segs[5]) }); return; }
      }
      // automations
      if (segs[4] === 'automations') {
        if (req.method === 'GET') { send(res, 200, { ok: true, automations: sendMod.listAutomations(clientId) }); return; }
        if (req.method === 'POST') { send(res, 200, { ok: true, automation: sendMod.addAutomation(clientId, body) }); return; }
        if (req.method === 'PUT' && segs[5]) { send(res, 200, { ok: true, automation: sendMod.updateAutomation(clientId, segs[5], body) }); return; }
        if (req.method === 'DELETE' && segs[5]) { send(res, 200, { ok: sendMod.deleteAutomation(clientId, segs[5]) }); return; }
      }
      // templates
      if (segs[4] === 'templates') {
        if (req.method === 'GET') { send(res, 200, { ok: true, templates: sendMod.listTemplates(clientId) }); return; }
        if (req.method === 'POST') { send(res, 200, { ok: true, template: sendMod.addTemplate(clientId, body) }); return; }
      }
      // messages
      if (segs[4] === 'messages') {
        if (req.method === 'GET') { const contactId = agencyUrl.searchParams.get('contactId'); send(res, 200, { ok: true, messages: sendMod.listMessages(clientId, contactId) }); return; }
      }

      // POST /clients/:id/draft — AI draft a message for a contact + automation type (PREVIEW)
      if (req.method === 'POST' && segs[4] === 'draft') {
        const { contactId, automationType, context } = body;
        const contact = sendMod.listContacts(clientId).find(c => c.id === contactId);
        if (!contact) { send(res, 404, { ok: false, error: 'Contact not found' }); return; }
        const text = await sendMod.draftMessage(client.profile, contact, automationType, context);
        const msg = sendMod.logMessage(clientId, {
          contactId, channel: agency.AUTOMATION_CATALOG[automationType]?.channel || 'sms',
          automationType, direction: 'outbound', body: text, status: 'draft',
        });
        send(res, 200, { ok: true, message: msg });
        return;
      }

      // POST /clients/:id/send — approve + send a drafted message
      if (req.method === 'POST' && segs[4] === 'send') {
        const { messageId } = body;
        const msgs = sendMod.listMessages(clientId);
        const msg = msgs.find(m => m.id === messageId);
        if (!msg) { send(res, 404, { ok: false, error: 'Message not found' }); return; }
        if (msg.status === 'sent') { send(res, 200, { ok: false, error: 'Already sent' }); return; }
        const contact = sendMod.listContacts(clientId).find(c => c.id === msg.contactId);
        let sendResult;
        if (msg.channel === 'none') {
          // Content-generation automations (social posts, GBP updates) — no outbound send; mark as published
          sendResult = { ok: true, simulated: false, note: 'Content generated (no outbound send) — ready to copy/paste to platform.' };
        } else if (msg.channel === 'sms') {
          const to = contact?.phone || '';
          const sp = client.profile.smsProvider || {};
          if (sp.sid && sp.token && sp.fromNumber) {
            sendResult = await sendMod.sendTwilio(sp.sid, sp.token, sp.fromNumber, to, msg.body);
          } else {
            sendResult = sendMod.simulate('sms', to, msg.body);
          }
        } else { // email
          const to = contact?.email || '';
          let subject = msg.body.split('\n')[0].replace(/^SUBJECT:\s*/i, '').trim();
          let emailBody = msg.body.split('\n').slice(1).join('\n').trim();
          if (!emailBody) { emailBody = msg.body; subject = client.profile.name + ' Update'; }
          const ep = client.profile.emailProvider || {};
          if (ep.host && ep.user && ep.pass && ep.from) {
            sendResult = await sendMod.sendSMTP(ep, to, subject, emailBody);
          } else {
            sendResult = sendMod.simulate('email', to, msg.body);
          }
        }
        const updated = sendMod.updateMessage(clientId, messageId, {
          status: sendResult.ok ? 'sent' : 'failed',
          sentAt: agency.nowISO(),
          sendResult,
        });
        send(res, 200, { ok: sendResult.ok, message: updated, sendResult });
        return;
      }

      // POST /clients/:id/run-automation — generate drafts for all matching contacts
      if (req.method === 'POST' && segs[4] === 'run-automation') {
        const { automationId } = body;
        const autos = sendMod.listAutomations(clientId);
        const auto = autos.find(a => a.id === automationId);
        if (!auto) { send(res, 404, { ok: false, error: 'Automation not found' }); return; }
        const contacts = sendMod.listContacts(clientId).filter(c => (auto.tags?.length ? auto.tags.some(t => c.tags?.includes(t)) : true) && c.status !== 'opted_out');
        const drafts = [];
        for (const contact of contacts.slice(0, 50)) {
          const text = await sendMod.draftMessage(client.profile, contact, auto.type, auto.context);
          const msg = sendMod.logMessage(clientId, {
            contactId: contact.id, channel: auto.channel || agency.AUTOMATION_CATALOG[auto.type]?.channel || 'sms',
            automationType: auto.type, automationId: auto.id, direction: 'outbound', body: text, status: 'draft',
          });
          drafts.push({ contactName: contact.name, contactId: contact.id, messageId: msg.id, preview: text.slice(0, 100) });
        }
        sendMod.updateAutomation(clientId, automationId, { runs: (auto.runs || 0) + 1, lastRun: agency.nowISO() });
        send(res, 200, { ok: true, draftsGenerated: drafts.length, drafts });
        return;
      }

      // ---- Research: competitor research (AI + web search) ----
      if (segs[4] === 'research' && req.method === 'GET') {
        const researchMod = await import('./agency-research.mjs');
        send(res, 200, { ok: true, research: researchMod.listResearch(clientId) });
        return;
      }
      if (segs[4] === 'research' && req.method === 'POST') {
        const researchMod = await import('./agency-research.mjs');
        const { prompt } = body;
        if (!prompt) { send(res, 400, { ok: false, error: 'prompt required' }); return; }
        const result = await researchMod.researchCompetitors(clientId, prompt);
        send(res, 200, result);
        return;
      }

      // ---- Analysis: business analyzation engine ----
      if (segs[4] === 'analysis' && req.method === 'GET') {
        const analysisMod = await import('./agency-analysis.mjs');
        send(res, 200, { ok: true, analysis: analysisMod.getAnalysis(clientId), questions: analysisMod.INTAKE_QUESTIONS });
        return;
      }
      if (segs[4] === 'intake' && req.method === 'POST') {
        const analysisMod = await import('./agency-analysis.mjs');
        const data = analysisMod.saveIntake(clientId, body);
        send(res, 200, { ok: true, analysis: data });
        return;
      }
      if (segs[4] === 'analyze' && req.method === 'POST') {
        const analysisMod = await import('./agency-analysis.mjs');
        const result = await analysisMod.runAnalysis(clientId);
        send(res, 200, result);
        return;
      }
      if (segs[4] === 'progress-loop' && req.method === 'POST') {
        const analysisMod = await import('./agency-analysis.mjs');
        const result = await analysisMod.runProgressLoop(clientId);
        send(res, 200, result);
        return;
      }
    }

    // ─── Friend Agent Bridge ─────────────────────────────────────
    // POST /api/agency/send-to-friend — send task to friend's Hermes
    if (req.method === 'POST' && segs[2] === 'send-to-friend') {
      const { task, from_agent, project, priority } = body;
      if (!task) { send(res, 400, { ok: false, error: 'No task provided' }); return; }
      const F_URL = 'https://raise-promoting-fought-trained.trycloudflare.com/webhooks/smartops-bridge';
      const F_SEC = process.env.FRIEND_WEBHOOK_SECRET || '';
      // Read secret from file if not in env
      let secret = F_SEC;
      if (!secret) {
        try { secret = readFileSync('C:/Users/shahe/friend-secret.txt', 'utf-8').trim(); } catch {}
      }
      const webhookBody = JSON.stringify({ task, from_agent: from_agent || 'SmartOps Foundry', project: project || 'general', priority: priority || 'normal' });
      const sig = createHmac('sha256', secret).update(webhookBody).digest('hex');
      try {
        const r = await fetch(F_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sig }, body: webhookBody, signal: AbortSignal.timeout(15000) });
        const t = await r.text();
        send(res, 200, { ok: true, status: r.status, response: t, sent: { task, from_agent, project, priority } });
      } catch (err) {
        send(res, 502, { ok: false, error: 'Failed to reach friend agent: ' + err.message });
      }
      return;
    }

    // GET /api/agency/friend-status — check if friend's agent is online
    if (req.method === 'GET' && segs[2] === 'friend-status') {
      const F_URL = 'https://raise-promoting-fought-trained.trycloudflare.com/webhooks/smartops-bridge';
      try {
        const r = await fetch(F_URL, { method: 'GET', signal: AbortSignal.timeout(8000) });
        send(res, 200, { online: true, status: r.status });
      } catch {
        send(res, 200, { online: false });
      }
      return;
    }

    // Fallback: unrecognized agency route
    send(res, 404, { ok: false, error: 'Unknown agency route: ' + p });
    return;
  }

  // ---- Niche Config endpoint ----------------------------------------------
  const NICHE_CONFIG_PATH = 'C:/Users/shahe/Desktop/clip-builder/niche-config.json';
  if (req.method === 'GET' && req.url === '/api/clip/niches') {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(NICHE_CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(NICHE_CONFIG_PATH, 'utf-8'));
        send(res, 200, config);
      } else {
        send(res, 404, { ok: false, error: 'Niche config not found' });
      }
    } catch (e) {
      send(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Niche system — full event-aware config
  const NICHE_SYSTEM_PATH = 'C:/Users/shahe/Desktop/clip-builder/niche-system.json';
  const nicheUrl = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && nicheUrl.pathname === '/api/clip/niche-system') {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(NICHE_SYSTEM_PATH)) {
        const sys = JSON.parse(fs.readFileSync(NICHE_SYSTEM_PATH, 'utf-8'));
        send(res, 200, sys);
      } else { send(res, 404, { ok: false, error: 'Niche system not found' }); }
    } catch (e) { send(res, 500, { ok: false, error: e.message }); }
    return;
  }
  // Niche events — upcoming events for a specific niche
  if (req.method === 'GET' && nicheUrl.pathname === '/api/clip/niche-events') {
    const niche = nicheUrl.searchParams.get('niche') || 'football';
    try {
      const fs = await import('node:fs');
      const sys = JSON.parse(fs.readFileSync(NICHE_SYSTEM_PATH, 'utf-8'));
      const n = sys.niches?.[niche];
      if (n) { send(res, 200, { ok: true, niche, events: n.event_calendar || [], individuals: n.individuals || [], proactive: n.proactive_strategy || {} }); }
      else { send(res, 404, { ok: false, error: 'Niche not found' }); }
    } catch (e) { send(res, 500, { ok: false, error: e.message }); }
    return;
  }
  // PROACTIVE clip generation — given an event, generate clip ideas + search queries
  if (req.method === 'POST' && nicheUrl.pathname === '/api/clip/proactive') {
    const body = await readBody(req);
    const { niche, event } = body;
    if (!niche || !event) { send(res, 400, { ok: false, error: 'Missing niche or event' }); return; }
    try {
      const fs = await import('node:fs');
      const sys = JSON.parse(fs.readFileSync(NICHE_SYSTEM_PATH, 'utf-8'));
      const n = sys.niches?.[niche];
      if (!n) { send(res, 400, { ok: false, error: 'Niche not found' }); return; }
      const individuals = (n.individuals || []).map(i => i.name).join(', ');
      const formats = Object.entries(n.formats).map(([k,f]) => k + ': ' + f.description).join('; ');
      const proactivePrompt = 'You are a viral ' + n.name + ' short-form clip strategist. An event is coming up. Generate clip ideas PROACTIVELY to build engagement around this event BEFORE it happens.\n\nNICHE: ' + n.name + '\nEVENT: ' + JSON.stringify(event) + '\nTOP INDIVIDUALS: ' + individuals + '\nAVAILABLE FORMATS: ' + formats + '\n\nGenerate 3 clip ideas to capitalize on this event. For each idea:\n- format: the format key from the list above\n- subject: the specific individual(s) to feature\n- search_queries: 2-3 YouTube search terms to find source footage (SPECIFIC to the event and individuals — not generic)\n- hook_text: bold text for first 3 seconds\n- subtitle_text: subtitle text to burn in\n- clip_angle: the narrative angle (why this clip will go viral)\n- timing: when to post relative to the event\n\nOutput ONLY a JSON array of 3 objects. No markdown.';
      const reply = await callOpenRouterDirect({ model: FAST_MODEL, systemPrompt: 'You are a viral clip strategist. Stay ON TOPIC. Output ONLY valid JSON. No markdown fences.', context: '', userMessage: proactivePrompt, maxTokens: 4000 });
      let ideas = [];
      let raw = (reply || '').replace(/```json\n?/gi, '').replace(/```/g, '').trim();
      const s = raw.indexOf('['), e = raw.lastIndexOf(']');
      if (s !== -1 && e !== -1) {
        try { ideas = JSON.parse(raw.substring(s, e+1)); } catch { try { ideas = JSON.parse(raw.substring(s, e+1).replace(/,\s*]/g, ']')); } catch {} }
      }
      send(res, 200, { ok: true, niche, event, ideas });
    } catch (e) { send(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // ---- Clip Builder endpoints ---------------------------------------------
  const CLIP_TWITTER = 'C:/Users/shahe/AppData/Local/hermes/hermes-agent/venv/Scripts/twitter';
  const CLIP_YTDLP = 'C:/Users/shahe/AppData/Local/hermes/hermes-agent/venv/Scripts/yt-dlp';
  const CLIP_FFMPEG = 'C:/Users/shahe/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg';
  const CLIP_DIR = 'C:/Users/shahe/Desktop/clip-builder';
  const clipUrl = new URL(req.url, 'http://localhost');

  // 1. Scan Twitter for trending clips
  if (req.method === 'GET' && clipUrl.pathname === '/api/clip/scan') {
    const q = clipUrl.searchParams.get('q') || 'football';
    const n = clipUrl.searchParams.get('n') || '20';
    const result = await runCmd(CLIP_TWITTER, ['search', q, '-n', n, '--type', 'videos', '--json'], { timeout: 60000, env: getTwitterCreds() });
    try {
      const parsed = JSON.parse(result.stdout);
      if (!parsed.ok) { send(res, 200, { ok: false, error: parsed.error?.message || 'Twitter search failed', tweets: [] }); return; }
      const tweets = scoreTweets(parsed.data || [], 30);
      send(res, 200, { ok: true, query: q, count: tweets.length, tweets });
    } catch (e) {
      send(res, 200, { ok: false, error: result.stderr || e.message, tweets: [] });
    }
    return;
  }

  // 2. Generate clip spec via GLM 5.2 (uses orchestrator coach path)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/spec') {
    const body = await readBody(req);
    const tweet = body.tweet || {};
    const formula = body.formula || 'auto';
    const specPrompt = `You are a viral short-form clip architect. A trending tweet was found. Generate a complete clip spec for a 28-58 second short-form video (YouTube Short / IG Reel).

TRENDING TWEET:
- Author: @${tweet.screenName || 'unknown'}
- Views: ${(tweet.views || 0).toLocaleString()}
- Like rate: ${tweet.likeRate || 0}%
- Text: "${tweet.text || ''}"

VIRAL FORMULA TO APPLY: ${formula === 'auto' ? 'Pick the best of: (1) Relatable Meme "How it feels when...", (2) Storytelling "Never forget...", (3) Shock opener, (4) All-caps hype, (5) Debate bait. Choose based on the tweet content.' : formula}

OUTPUT a JSON spec with these fields (and nothing else):
{
  "formula": "the formula name you chose",
  "hook_caption": "under 60 chars, the on-screen text / tweet caption",
  "clip_length": "28-58s target",
  "story_arc": { "hook": "0-3s: what happens", "setup": "3-20s: context/tension", "payoff": "20-Xs: the moment", "loop": "seamless loop back to hook" },
  "captions_style": "bold, minimal, <=6 words per screen",
  "audio": "trending audio or dramatic silence + crowd reaction",
  "estimated_potential": "based on formula avg views + source validation",
  "cut_instructions": "what to look for in the source video, approximate timestamp hints"
}`;
    try {
      const reply = await callOpenRouterDirect({ model: FAST_MODEL, systemPrompt: 'You are a viral clip architect. Output only valid JSON.', context: '', userMessage: specPrompt });
      send(res, 200, { ok: true, spec: reply, tweet, formula });
    } catch (e) {
      send(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 3. Download source video (yt-dlp)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/download') {
    const body = await readBody(req);
    const url = body.url;
    if (!url) { send(res, 400, { ok: false, error: 'No URL provided' }); return; }
    const outDir = CLIP_DIR + '/downloads';
    const fs = await import('node:fs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFilePattern = outDir + '/%(id)s.%(ext)s';
    // Use --print to reliably get the output filename
    const result = await runCmd(CLIP_YTDLP, ['-f', 'mp4', '-o', outFilePattern, '--no-playlist', '--print', 'after_move:filepath', url], { timeout: 300000 });
    // Extract filename from --print output (last non-empty line of stdout)
    const lines = result.stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const filepath = lines.length > 0 ? lines[lines.length - 1] : null;
    // Also try Destination regex as fallback
    const fnMatch = result.stderr.match(/Destination:\s*(.+)/);
    const resolvedFile = filepath || (fnMatch ? fnMatch[1].trim() : null);
    // Check if file actually exists (yt-dlp exit code is unreliable)
    const fileExists = resolvedFile && fs.existsSync(resolvedFile);
    // If we don't have a resolved file, try to find the newest file in downloads
    let finalFile = resolvedFile;
    if (!fileExists) {
      try {
        const files = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')).map(f => ({
          name: f, mtime: fs.statSync(outDir + '/' + f).mtime.getTime()
        })).sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0 && Date.now() - files[0].mtime < 60000) {
          finalFile = outDir + '/' + files[0].name;
        }
      } catch {}
    }
    const ok = finalFile && fs.existsSync(finalFile);
    const size = ok ? fs.statSync(finalFile).size : 0;
    send(res, 200, { ok, exitCode: result.exitCode, filename: finalFile, size, stderr: result.stderr.slice(-500), stdout: result.stdout.slice(-500) });
    return;
  }

  // 4. Cut a clip from a downloaded video (ffmpeg)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/cut') {
    const body = await readBody(req);
    const { input, start, duration, output } = body;
    if (!input || !start || !duration) { send(res, 400, { ok: false, error: 'Missing input/start/duration' }); return; }
    const outFile = output || (CLIP_DIR + '/clips/clip-' + Date.now() + '.mp4');
    const result = await runCmd(CLIP_FFMPEG, ['-y', '-i', input, '-ss', start, '-t', duration, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', outFile], { timeout: 120000 });
    send(res, 200, { ok: result.exitCode === 0, exitCode: result.exitCode, output: outFile, stderr: result.stderr.slice(-1000) });
    return;
  }

  // 5. Edit engine — full transform pipeline (verticalize + subtitles + SFX + grade + encode)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/edit') {
    const body = await readBody(req);
    const { input, spec, sfx, music } = body;
    if (!input || !spec) { send(res, 400, { ok: false, error: 'Missing input or spec' }); return; }
    const fs = await import('node:fs');
    if (!fs.existsSync(input)) { send(res, 400, { ok: false, error: 'Input file not found: ' + input }); return; }
    const outDir = CLIP_DIR + '/clips';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = outDir + '/edited-' + Date.now() + '.mp4';
    const specJson = JSON.stringify(spec);
    // Build args properly — include --sfx, --tweet-img
    const pyArgs = [CLIP_DIR + '/edit-clip-v6.py', input, outFile, specJson];
    if (sfx) pyArgs.push('--sfx', sfx);
    if (body.tweet_img) pyArgs.push('--tweet-img', body.tweet_img);
    const pyBin = 'C:/Users/shahe/AppData/Local/hermes/hermes-agent/venv/Scripts/python';
    const result = await runCmd(pyBin, pyArgs, { timeout: 600000 });
    // Check if output was created
    const ok = fs.existsSync(outFile);
    const size = ok ? fs.statSync(outFile).size : 0;
    // Extract the JSON result from the last line of stdout
    let editInfo = null;
    try {
      const jsonLine = result.stdout.split('\n').filter(l => l.trim().startsWith('{')).pop();
      if (jsonLine) editInfo = JSON.parse(jsonLine);
    } catch {}
    send(res, 200, { ok, output: ok ? outFile : null, size, filename: ok ? outFile : null, editInfo, stderr: result.stderr.slice(-2000), stdout: result.stdout.slice(-2000), exitCode: result.exitCode });
    return;
  }

  // 6. Transcribe a video/audio file (for auto-subtitles) — uses agent-reach
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/transcribe') {
    const body = await readBody(req);
    const { url } = body;
    if (!url) { send(res, 400, { ok: false, error: 'No URL provided' }); return; }
    const pyBin = 'C:/Users/shahe/AppData/Local/hermes/hermes-agent/venv/Scripts/python';
    const result = await runCmd(pyBin, ['-m', 'agent_reach.cli', 'transcribe', url], { timeout: 180000 });
    send(res, 200, { ok: result.exitCode === 0, transcript: result.stdout.slice(0, 5000), stderr: result.stderr.slice(-1000), exitCode: result.exitCode });
    return;
  }

  // 7. Tweet/Trend Analyzer — niche-aware classification
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/analyze') {
    const body = await readBody(req);
    const tweet = body.tweet || {};
    const niche = body.niche || 'football';
    let nicheFormats = {};
    let nicheName = 'football';
    try {
      const fs = await import('node:fs');
      const config = JSON.parse(fs.readFileSync(NICHE_CONFIG_PATH, 'utf-8'));
      const n = config.niches?.[niche];
      if (n) { nicheFormats = n.formats || {}; nicheName = n.name || niche; }
    } catch {}

    const formatList = Object.entries(nicheFormats).map(([key, f]) =>
      key + ' (' + f.name + '): ' + f.description + ' Structure: ' + f.structure
    ).join('\n');

    const analyzePrompt = 'You are a viral ' + nicheName + ' short-form clip strategist. Analyze this trending content and determine what KIND of clip to make.\n\nTRENDING CONTENT:\n- Author: @' + (tweet.screenName || 'unknown') + '\n- Views: ' + (tweet.views || 0).toLocaleString() + '\n- Text: "' + (tweet.text || '') + '"\n\nAVAILABLE FORMATS for ' + nicheName + ':\n' + formatList + '\n\nClassify this content into the BEST format type from the list above. CRITICAL RULE: The search_queries MUST be specifically tailored to the subject and the specific trend/moment mentioned in the tweet. Do NOT use generic queries. Include the specific names, events, and context to find the EXACT source footage that matches this specific clip.\n\nSEARCH QUERY RULES (very important):\n- If this is about a RECENT or UPCCOMING event (e.g. a fight this weekend, a transfer this window, a stream happening now), include the year in your search queries (e.g. "Conor McGregor UFC 329 2025" not just "Conor McGregor highlights") to find RECENT footage, not old clips from years ago.\n- If this is about a nostalgic/historical moment, queries WITHOUT a year are fine.\n- Each query should be specific enough to find footage of the EXACT subject and event, not generic category clips.\n- Use 2-3 queries with different angles (e.g. official highlights, fan footage, press conference).\n\nAlso determine:\n- type: the format key (e.g. SHUT_UP, KO_HIGHLIGHT, HIGHLIGHT, DRAMA, etc.)\n- subject: the main player/fighter/streamer/team the clip should feature\n- search_queries: 2-3 YouTube search terms to find source video footage (tailored to the specific trend, WITH year if recent event)\n- tweet_popup: true if a tweet/trend card should be shown as on-screen overlay\n- popup_text: the text to display on the popup card\n- edit_style: specific editing instructions based on the format structure\n- hook_text: the big bold text for the first 3 seconds\n- subtitle_text: the full subtitle text to burn in\n- start: suggested start point HH:MM:SS in source video\n- duration: suggested clip duration in seconds\n\nOutput ONLY a JSON object. No markdown, no explanation.';

    try {
      const reply = await callOpenRouterDirect({ model: FAST_MODEL, systemPrompt: 'You are a viral clip strategist. CRITICAL: Stay ON TOPIC. The search_queries must specifically find footage of the EXACT subject identified. Do not search for generic clips — search for the specific player/fighter/streamer/team and the specific event/moment mentioned. Output ONLY valid JSON. No markdown fences.', context: '', userMessage: analyzePrompt, maxTokens: 2000 });
      let analysis = null;
      let rawText = (reply || '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const sIdx = rawText.indexOf('{');
      const eIdx = rawText.lastIndexOf('}');
      if (sIdx !== -1 && eIdx !== -1) {
        try { analysis = JSON.parse(rawText.substring(sIdx, eIdx + 1)); }
        catch { try { analysis = JSON.parse(rawText.substring(sIdx, eIdx + 1).replace(/,/g, '}').replace(/}/g, '}')); } catch {} }
      }
      if (analysis && analysis.type && nicheFormats[analysis.type]) {
        analysis.format_config = nicheFormats[analysis.type];
      }
      send(res, 200, { ok: true, analysis, niche, tweet });
    } catch (e) {
      send(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 7b. Auto-find source videos — INTELLIGENT: dual search (relevance + recency) + AI verification
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/find-videos') {
    const body = await readBody(req);
    const queries = body.queries || [];
    const context = body.context || '';  // tweet text or event description for AI relevance check
    const recency = body.recency || 'auto';  // 'recent' (events), 'any' (nostalgia), 'auto'
    if (!queries.length) { send(res, 400, { ok: false, error: 'No search queries provided' }); return; }

    const PRINT_FMT = '%(id)s|||%(title)s|||%(duration)s|||%(view_count)s|||%(uploader)s';
    const results = [];
    const ids = [];

    // SEARCH: ytsearch8 per query (relevance). Upload_date extracted in batch pass below.
    for (const q of queries.slice(0, 3)) {
      const rRel = await runCmd(CLIP_YTDLP, ['--flat-playlist', '--print', PRINT_FMT, 'ytsearch8:' + q], { timeout: 60000 });
      for (const line of rRel.stdout.split('\n').filter(l => l.trim())) {
        const parts = line.split('|||');
        if (parts.length >= 2 && parts[0]) {
          results.push({
            query: q, search_type: 'relevance',
            video_id: parts[0], title: parts[1] || '',
            duration: parts[2] || '?', views: parts[3] || '0',
            uploader: parts[4] || '', upload_date: '',
            url: 'https://www.youtube.com/watch?v=' + parts[0],
          });
          if (!ids.includes(parts[0])) ids.push(parts[0]);
        }
      }
    }

    // Deduplicate by video_id
    const seen = new Set();
    const unique = results.filter(v => {
      if (seen.has(v.video_id)) return false;
      seen.add(v.video_id); return true;
    });

    // BATCH EXTRACT upload dates — flat-playlist can't get them, so we do a
    // single yt-dlp pass over all unique IDs (fast: ~2.5s per video).
    if (unique.length > 0) {
      const dateArgs = ['--print', '%(id)s|||%(upload_date)s', '--skip-download', '--no-warnings', ...unique.map(v => v.video_id)];
      const rDates = await runCmd(CLIP_YTDLP, dateArgs, { timeout: 90000 });
      const dateMap = {};
      for (const line of rDates.stdout.split('\n').filter(l => l.trim())) {
        const [vid, udate] = line.split('|||');
        if (vid && udate) dateMap[vid] = udate;
      }
      for (const v of unique) { v.upload_date = dateMap[v.video_id] || ''; }
    }

    // Compute recency score (0-1): newer = closer to 1
    const now = new Date();
    for (const v of unique) {
      if (v.upload_date && v.upload_date.length === 8) {
        const d = new Date(v.upload_date.slice(0,4) + '-' + v.upload_date.slice(4,6) + '-' + v.upload_date.slice(6,8));
        const daysOld = Math.max(0, (now - d) / 86400000);
        v.days_old = Math.round(daysOld);
        v.age_label = daysOld < 7 ? 'this week' : daysOld < 30 ? 'this month' : daysOld < 90 ? '3 months' : daysOld < 365 ? 'this year' : Math.round(daysOld/365) + 'y ago';
        // Recency score: 1.0 if today, 0.5 at 90 days, 0.3 at 1 year, 0.1 at 2+ years
        v.recency_score = Math.max(0.1, 1.0 * Math.exp(-daysOld / 120));
      } else {
        v.days_old = null; v.age_label = '?'; v.recency_score = 0.3;
      }
    }

    // Pre-rank: combine views (normalized) + recency. This gives us a shortlist for AI.
    const maxViews = Math.max(...unique.map(v => parseInt(v.views) || 0), 1);
    for (const v of unique) {
      const viewScore = (parseInt(v.views) || 0) / maxViews;
      const recencyWeight = (recency === 'recent') ? 0.6 : (recency === 'any') ? 0.15 : 0.35;
      v.pre_rank_score = viewScore * (1 - recencyWeight) + v.recency_score * recencyWeight;
    }
    unique.sort((a, b) => b.pre_rank_score - a.pre_rank_score);

    // Take top 12 candidates for AI verification
    const candidates = unique.slice(0, 12);

    // AI VERIFICATION: GLM scores each candidate for relevance to the specific tweet/event
    let ranked = candidates;
    if (context && candidates.length > 0) {
      const candList = candidates.map((c, i) =>
        `${i+1}. "${c.title}" | by ${c.uploader} | ${c.age_label} | ${parseInt(c.views)||0} views | (id:${c.video_id})`
      ).join('\n');
      const verifyPrompt = `You are an intelligent video researcher. A clip is being built for a SPECIFIC trending topic. Your job is to look at YouTube search results and determine which ones ACTUALLY match the specific subject/event/moment — not just generic or old clips with the same name.

TRENDING TOPIC / CONTEXT:
"${context}"

YOUTUBE SEARCH RESULTS (title, channel, age, views):
${candList}

For EACH result, score it 0-100 based on:
- RELEVANCE to the specific subject/event/moment in the context (not just same name/category)
- RECENCY — if the context is about a recent/upcoming event, newer is much better. If it's nostalgia/highlight, older is OK.
- FOOTAGE QUALITY — does the title suggest actual usable footage (highlights, full fight, press conference, clip, moment) vs opinion/analysis/reaction channels?

Output ONLY a JSON array. Each element: {"index": <1-based number>, "score": <0-100>, "reason": "<one short phrase>"}
Sort the array by score descending. Output the top 8 results.`;
      try {
        const reply = await callOpenRouterDirect({
          model: FAST_MODEL,
          systemPrompt: 'You are an intelligent YouTube research assistant. You verify which search results actually match a specific topic. Output ONLY valid JSON arrays. No markdown fences.',
          context: '', userMessage: verifyPrompt, maxTokens: 1500
        });
        let rawText = (reply || '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        const sIdx = rawText.indexOf('['); const eIdx = rawText.lastIndexOf(']');
        if (sIdx !== -1 && eIdx !== -1) {
          const scored = JSON.parse(rawText.substring(sIdx, eIdx + 1));
          // Map scores back to candidates and re-sort
          const scoreMap = {};
          for (const s of scored) { scoreMap[s.index - 1] = { score: s.score, reason: s.reason }; }
          ranked = candidates
            .map((c, i) => ({ ...c, ai_score: scoreMap[i]?.score ?? 50, ai_reason: scoreMap[i]?.reason ?? '' }))
            .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
            .slice(0, 8);
        }
      } catch (e) {
        // If AI fails, fall back to pre-rank
        ranked = candidates.slice(0, 8);
      }
    }

    send(res, 200, { ok: true, count: ranked.length, videos: ranked, search_context: context, recency_mode: recency });
    return;
  }

  // 7c. Generate tweet popup image
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/tweet-image') {
    const body = await readBody(req);
    const { name, handle, text, avatar_color, metrics, dark, format_type } = body;
    if (!name || !handle || !text) { send(res, 400, { ok: false, error: 'Missing name/handle/text' }); return; }
    const pyBin = 'C:/Users/shahe/AppData/Local/hermes/hermes-agent/venv/Scripts/python';
    const imgPath = CLIP_DIR + '/tmp/tweet-' + Date.now() + '.png';
    const args = [CLIP_DIR + '/tweet-image.py', imgPath, '--name', name, '--handle', handle, '--text', text];
    if (avatar_color) args.push('--avatar', avatar_color);
    if (metrics) args.push('--metrics', metrics);
    if (dark) args.push('--dark');
    if (format_type) args.push('--format', format_type);
    const result = await runCmd(pyBin, args, { timeout: 30000 });
    const fs = await import('node:fs');
    const ok = fs.existsSync(imgPath);
    send(res, 200, { ok, path: ok ? imgPath : null, stderr: result.stderr.slice(-500) });
    return;
  }

  // 7d. Generate 3 clip ideas (blueprint) — GLM 5.2 produces 3 different approaches
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/blueprint') {
    const body = await readBody(req);
    const tweet = body.tweet || {};
    const bpPrompt = 'You are a viral short-form VIDEO clip architect for YouTube Shorts, Instagram Reels, and TikTok. A trending football/soccer tweet was found. Generate THREE different VIDEO clip concepts — each using a DIFFERENT viral formula — so the user can pick the best one.\n\nTRENDING TWEET:\n- Author: @' + (tweet.screenName || 'unknown') + '\n- Views: ' + (tweet.views || 0).toLocaleString() + '\n- Like rate: ' + (tweet.likeRate || 0) + '%\n- Text: "' + (tweet.text || '') + '"\n\nFor EACH of the 3 ideas, use one of these formulas:\n1. RELATABLE MEME — How it feels when (avg 5.25M views)\n2. STORYTELLING — Never forget the moment (avg 2.75M views)\n3. ALL-CAPS HYPE — short punchy all-caps (highest engagement, 4.2% like rate)\n\nFor each idea, output a JSON object with these EXACT fields:\n- formula: the formula name\n- hook_caption: under 60 chars, the BIG text shown on screen in the first 3 seconds\n- narration: 2-3 sentences of voiceover commentary explaining what happened\n- subtitle_text: the full text to burn in as subtitles throughout the clip\n- start: HH:MM:SS best start point in source video (use 00:00:05 if unknown)\n- duration: 30\n- clip_length: target 28-58s as a string like 34s\n- story_arc: hook (0-4s), setup (4-15s), action (15-Xs), verdict (X-50s), loop (50-Xs)\n- sfx_plan: which sound effects at which moments (whoosh at 0s, impact at 5s, crowd at 20s)\n- edit_notes: specific video editing instructions (transitions, zoom, slow-mo, color mood, text overlays)\n- estimated_potential: based on formula avg + source engagement\n\nOutput ONLY a JSON array of 3 objects. Start with [ and end with ]. No markdown fences, no explanation.';
    try {
      const reply = await callOpenRouterDirect({ model: FAST_MODEL, systemPrompt: 'You are a viral video clip architect. Output ONLY valid JSON. No markdown fences, no explanation, just a JSON array starting with [ and ending with ].', context: '', userMessage: bpPrompt, maxTokens: 4000 });
      let ideas = [];
      let rawText = (reply || '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const startIdx = rawText.indexOf('[');
      const endIdx = rawText.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
          ideas = JSON.parse(rawText.substring(startIdx, endIdx + 1));
          if (!Array.isArray(ideas)) ideas = [ideas];
        } catch (e1) {
          try {
            const fixed = rawText.substring(startIdx, endIdx + 1).replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
            ideas = JSON.parse(fixed);
            if (!Array.isArray(ideas)) ideas = [ideas];
          } catch (e2) {}
        }
      }
      send(res, 200, { ok: true, ideas, raw: (reply || '').slice(0, 500), tweet });
    } catch (e) {
      send(res, 500, { ok: false, error: e.message, ideas: [] });
    }
    return;
  }
  // 8. Generate tweet text from a custom prompt (for posting)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/tweet-gen') {
    const body = await readBody(req);
    const { prompt, clip_context } = body;
    if (!prompt) { send(res, 400, { ok: false, error: 'No prompt provided' }); return; }
    const tweetPrompt = 'Write a tweet to post with a viral football short-form clip. User instruction: "' + prompt + '"\n\nClip context: ' + JSON.stringify(clip_context || {}).slice(0, 500) + '\n\nRules:\n- Under 270 characters (leave room for media)\n- Include 1-2 relevant emojis\n- Use a viral hook formula (relatable meme, storytelling, hype, or debate bait)\n- No hashtags (they reduce engagement on X)\n- Plain text only, no quotes around it\n\nOutput ONLY the tweet text. Nothing else.';
    try {
      const reply = await callOpenRouterDirect({ model: FAST_MODEL, systemPrompt: 'You write viral tweets. Output only the tweet text.', context: '', userMessage: tweetPrompt });
      send(res, 200, { ok: true, tweet: reply.trim() });
    } catch (e) {
      send(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 9. Post a tweet with media (HUMAN APPROVAL GATE — requires confirm=true)
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/tweet-post') {
    const body = await readBody(req);
    const { text, media_path, confirm } = body;
    if (!text) { send(res, 400, { ok: false, error: 'No tweet text provided' }); return; }
    if (!confirm) { send(res, 200, { ok: false, error: 'APPROVAL REQUIRED — set confirm=true to actually post', preview: text }); return; }
    const args = ['post', text];
    if (media_path) args.push('--media', media_path);
    const result = await runCmd(CLIP_TWITTER, args, { timeout: 60000, env: getTwitterCreds() });
    send(res, 200, { ok: result.exitCode === 0, exitCode: result.exitCode, output: result.stdout.slice(0, 2000), stderr: result.stderr.slice(-1000) });
    return;
  }

  // 10. List all edited clips
  if (req.method === 'GET' && clipUrl.pathname === '/api/clip/list') {
    try {
      const fs = await import('node:fs');
      const clipsDir = CLIP_DIR + '/clips';
      if (!fs.existsSync(clipsDir)) { send(res, 200, { ok: true, clips: [] }); return; }
      const files = fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).map(f => {
        const stat = fs.statSync(clipsDir + '/' + f);
        return { filename: f, size: stat.size, created: stat.mtime.toISOString(),
                 preview_url: '/api/clip/preview/' + f, download_url: '/api/clip/download/' + f,
                 thumb_url: '/api/clip/thumb/' + f.replace(/\.mp4$/, '.jpg') };
      }).sort((a, b) => new Date(b.created) - new Date(a.created));
      send(res, 200, { ok: true, clips: files, dir: clipsDir });
    } catch (e) {
      send(res, 200, { ok: true, clips: [], error: e.message });
    }
    return;
  }

  // 11. Preview/stream a video file (supports HTTP range requests for seeking)
  const previewMatch = clipUrl.pathname.match(/^\/api\/clip\/preview\/(.+)$/);
  if ((req.method === 'GET' || req.method === 'HEAD') && previewMatch) {
    const fs = await import('node:fs');
    const filename = previewMatch[1].replace(/\.\.\//g, ''); // prevent path traversal
    const filePath = CLIP_DIR + '/clips/' + filename;
    if (!fs.existsSync(filePath)) { send(res, 404, { ok: false, error: 'File not found: ' + filename }); return; }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const baseHeaders = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Cache-Control': 'public, max-age=3600',
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
      res.end();
      return;
    }
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  // 11b. Serve thumbnail (generates on-the-fly with ffmpeg if missing, then caches)
  const thumbMatch = clipUrl.pathname.match(/^\/api\/clip\/thumb\/(.+)$/);
  if (req.method === 'GET' && thumbMatch) {
    const fs = await import('node:fs');
    const { execSync } = await import('node:child_process');
    const thumbName = thumbMatch[1].replace(/\.\.\//g, '');
    const baseName = thumbName.replace(/\.jpg$/, '');
    const clipsDir = CLIP_DIR + '/clips';
    const thumbDir = clipsDir + '/thumbs';
    const videoPath = clipsDir + '/' + baseName + '.mp4';
    const thumbPath = thumbDir + '/' + thumbName;
    if (!fs.existsSync(videoPath)) { send(res, 404, { ok: false, error: 'Video not found' }); return; }
    if (!fs.existsSync(thumbDir)) { fs.mkdirSync(thumbDir, { recursive: true }); }
    if (!fs.existsSync(thumbPath)) {
      try {
        const FFP = 'C:/Users/shahe/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin';
        const ffprobe = FFP + '/ffprobe.exe';
        const ffmpeg = FFP + '/ffmpeg.exe';
        let dur = 30;
        try { const pj = JSON.parse(execSync(`"${ffprobe}" -v quiet -print_format json -show_format "${videoPath}"`).toString()); dur = parseFloat(pj.format?.duration) || 30; } catch {}
        const seekT = Math.max(1, dur * 0.25);
        execSync(`"${ffmpeg}" -y -ss ${seekT} -i "${videoPath}" -vframes 1 -q:v 3 -vf "scale=270:480" "${thumbPath}"`, { timeout: 15000 });
      } catch (e) {
        send(res, 404, { ok: false, error: 'Thumb gen failed' }); return;
      }
    }
    try {
      const stat = fs.statSync(thumbPath);
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=3600' });
      fs.createReadStream(thumbPath).pipe(res);
    } catch { send(res, 404, { ok: false, error: 'Thumb read failed' }); }
    return;
  }

  // 12. Download a video file (forces download)
  const dlMatch = clipUrl.pathname.match(/^\/api\/clip\/download\/(.+)$/);
  if (req.method === 'GET' && dlMatch) {
    const fs = await import('node:fs');
    const filename = dlMatch[1].replace(/\.\.\//g, '');
    const filePath = CLIP_DIR + '/clips/' + filename;
    if (!fs.existsSync(filePath)) { send(res, 404, { ok: false, error: 'File not found: ' + filename }); return; }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 13. Delete a clip
  if (req.method === 'POST' && clipUrl.pathname === '/api/clip/delete') {
    const body = await readBody(req);
    const fs = await import('node:fs');
    const filename = (body.filename || '').replace(/\.\.\//g, '');
    const filePath = CLIP_DIR + '/clips/' + filename;
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); send(res, 200, { ok: true, deleted: filename }); }
    else { send(res, 404, { ok: false, error: 'Not found' }); }
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/orchestrator' || req.url === '/api/plan-day')) {
    const body = await readBody(req);
    const today = body.today || new Date().toISOString().slice(0, 10);
    const mode = body.mode || 'coach';
    const model = pickModel(mode);
    const systemPrompt = buildSystemPrompt(mode);
    const context = buildContext(body.appState || {}, today);
    const userMessage = body.userMessage || 'Give me my daily command brief.';

    try {
      let reply;
      if (mode === 'site') {
        // Power path — full Hermes agent (slower, but tools + reasoning).
        reply = await callHermes({ model, systemPrompt, context, userMessage });
      } else {
        // Fast path — direct OpenRouter (snappy daily coaching).
        reply = await callOpenRouterDirect({ model, systemPrompt, context, userMessage });
      }
      send(res, 200, { reply, model, path: mode === 'site' ? 'hermes' : 'direct' });
    } catch (e) {
      send(res, 500, { error: e.message || 'Orchestrator call failed' });
    }
    return;
  }

  // ---- AUTH SYSTEM (Stage 3B: handled by auth module at top of request handler) ----
  // The old inline auth system (hardcoded path, SHA-256, X-Auth-Token header)
  // has been replaced by the auth module (cookie sessions, scrypt hashing).
  // Auth routes are handled early in the request lifecycle — no inline block needed here.

  // ===== AUTOMATION LAB: benchmark-driven automation testing =====

  // Load benchmark data
  let benchmarkData = null;
  try {
    benchmarkData = JSON.parse(readFileSync(pathJoin(__dirname, '..', 'public', 'benchmark-data.json'), 'utf-8'));
  } catch (e) {
    // Try absolute path
    try {
      const p = 'C:/Users/shahe/Desktop/lifeos-v2-restored/lifeos-v2-ready/public/benchmark-data.json';
      benchmarkData = JSON.parse(readFileSync(p, 'utf-8'));
    } catch (e2) {
      benchmarkData = null;
    }
  }

  // GET /api/automation-lab/scenarios — list all 25 test scenarios
  if (req.method === 'GET' && req.url.startsWith('/api/automation-lab/scenarios')) {
    if (!benchmarkData) { send(res, 500, { ok: false, error: 'Benchmark data not loaded' }); return; }
    const parsed = new URL(req.url, 'http://localhost');
    const type = parsed.searchParams.get('type');
    const niche = parsed.searchParams.get('niche');
    let scenarios = benchmarkData.scenarios;
    if (type) scenarios = scenarios.filter(s => s.automation_type === type);
    if (niche) scenarios = scenarios.filter(s => s.niche === niche);
    send(res, 200, { ok: true, total: scenarios.length, scenarios: scenarios.map(s => ({
      id: s.id, automation_type: s.automation_type, niche: s.niche,
      company_name: s.company_name, customer_name: s.customer_name,
      scenario: s.scenario
    }))});
    return;
  }

  // GET /api/automation-lab/benchmark/:id — get full benchmark scenario with gold standard
  if (req.method === 'GET' && req.url.includes('/api/automation-lab/benchmark/')) {
    if (!benchmarkData) { send(res, 500, { ok: false, error: 'Benchmark data not loaded' }); return; }
    const id = req.url.split('/benchmark/')[1].split('?')[0];
    const scenario = benchmarkData.scenarios.find(s => s.id === id);
    if (!scenario) { send(res, 404, { ok: false, error: 'Scenario not found' }); return; }
    send(res, 200, { ok: true, scenario });
    return;
  }

  // POST /api/automation-lab/run — generate message for a scenario using AI, score vs benchmark
  if (req.method === 'POST' && req.url === '/api/automation-lab/run') {
    if (!benchmarkData) { send(res, 500, { ok: false, error: 'Benchmark data not loaded' }); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const { scenario_id } = JSON.parse(body);
    const scenario = benchmarkData.scenarios.find(s => s.id === scenario_id);
    if (!scenario) { send(res, 404, { ok: false, error: 'Scenario not found: ' + scenario_id }); return; }

    // Build the system prompt for the AI
    const automationPrompts = {
      missed_call_textback: 'You are an AI assistant for a service business. A customer called but no one answered. Write an SMS text-back message that is warm, professional, and urgent. Include the business name, acknowledge the missed call, and give a clear call-to-action to book or call back. Keep it under 160 characters. Do not use emojis excessively.',
      appointment_reminder: 'You are an AI assistant for a service business. Write an SMS appointment reminder that includes the business name, customer name, appointment date/time, and a brief friendly note. Keep it under 160 characters. Do not use emojis excessively.',
      review_request: 'You are an AI assistant for a service business. A job was just completed. Write an SMS asking the customer for a review. Be warm, thank them for their business, and provide a clear call-to-action (e.g., reply or click a link). Keep it under 160 characters. Do not use emojis excessively.',
      quote_followup: 'You are an AI assistant for a service business. Write a follow-up email for a quote that was sent to a customer days ago but not yet responded to. Be professional, restate the value briefly, address any concerns, and include a clear next step. Keep it under 200 words. Use a subject line.',
      no_show_recovery: 'You are an AI assistant for a service business. A customer missed their appointment. Write an SMS that is understanding (not accusatory), acknowledges the missed appointment, and offers an easy way to reschedule. Keep it under 160 characters. Do not use emojis excessively.'
    };

    const sysPrompt = automationPrompts[scenario.automation_type] || automationPrompts.missed_call_textback;
    const userInput = `Business: ${scenario.company_name}\nNiche: ${scenario.niche}\nCustomer: ${scenario.customer_name}\n\nScenario:\n${scenario.scenario}\n\nCustomer details:\n${JSON.stringify(scenario.input_data, null, 2)}\n\nWrite the message now. Output ONLY the message text, nothing else. No preamble, no explanation.`;

    try {
      const aiOutput = await callOpenRouterDirect({
        model: FAST_MODEL,
        systemPrompt: sysPrompt,
        context: `Automation: ${scenario.automation_type} | Niche: ${scenario.niche} | Company: ${scenario.company_name}`,
        userMessage: userInput,
        maxTokens: 2000
      });

      // Score the AI output against the benchmark
      const score = scoreAutomation(aiOutput, scenario);

      send(res, 200, {
        ok: true,
        scenario_id: scenario.id,
        automation_type: scenario.automation_type,
        niche: scenario.niche,
        company_name: scenario.company_name,
        customer_name: scenario.customer_name,
        ai_output: aiOutput,
        benchmark_output: scenario.benchmark_output,
        score: score.score,
        max_score: 100,
        passed: score.passed,
        criteria: score.criteria,
        scenario: scenario.scenario
      });
    } catch (err) {
      send(res, 500, { ok: false, error: 'AI generation failed: ' + err.message });
    }
    return;
  }

  // POST /api/automation-lab/run-all — run all 25 scenarios (or filter by type/niche)
  if (req.method === 'POST' && req.url === '/api/automation-lab/run-all') {
    if (!benchmarkData) { send(res, 500, { ok: false, error: 'Benchmark data not loaded' }); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const { type, niche, limit } = JSON.parse(body || '{}');
    let scenarios = benchmarkData.scenarios;
    if (type) scenarios = scenarios.filter(s => s.automation_type === type);
    if (niche) scenarios = scenarios.filter(s => s.niche === niche);
    if (limit) scenarios = scenarios.slice(0, limit);

    const automationPrompts = {
      missed_call_textback: 'You are an AI assistant for a service business. A customer called but no one answered. Write an SMS text-back message that is warm, professional, and urgent. Include the business name, acknowledge the missed call, and give a clear call-to-action to book or call back. Keep it under 160 characters. Do not use emojis excessively.',
      appointment_reminder: 'You are an AI assistant for a service business. Write an SMS appointment reminder that includes the business name, customer name, appointment date/time, and a brief friendly note. Keep it under 160 characters. Do not use emojis excessively.',
      review_request: 'You are an AI assistant for a service business. A job was just completed. Write an SMS asking the customer for a review. Be warm, thank them for their business, and provide a clear call-to-action. Keep it under 160 characters. Do not use emojis excessively.',
      quote_followup: 'You are an AI assistant for a service business. Write a follow-up email for a quote sent days ago but not responded to. Be professional, restate the value briefly, address concerns, include a clear next step. Keep it under 200 words. Use a subject line.',
      no_show_recovery: 'You are an AI assistant for a service business. A customer missed their appointment. Write an SMS that is understanding, acknowledges the missed appointment, and offers an easy way to reschedule. Keep it under 160 characters. Do not use emojis excessively.'
    };

    const results = [];
    for (const scenario of scenarios) {
      try {
        const sysPrompt = automationPrompts[scenario.automation_type] || automationPrompts.missed_call_textback;
        const userInput = `Business: ${scenario.company_name}\nNiche: ${scenario.niche}\nCustomer: ${scenario.customer_name}\n\nScenario:\n${scenario.scenario}\n\nCustomer details:\n${JSON.stringify(scenario.input_data, null, 2)}\n\nWrite the message now. Output ONLY the message text, nothing else.`;
        const aiOutput = await callOpenRouterDirect({
          model: FAST_MODEL,
          systemPrompt: sysPrompt,
          context: `Automation: ${scenario.automation_type} | Niche: ${scenario.niche}`,
          userMessage: userInput,
          maxTokens: 2000
        });
        const score = scoreAutomation(aiOutput, scenario);
        results.push({
          scenario_id: scenario.id,
          automation_type: scenario.automation_type,
          niche: scenario.niche,
          company_name: scenario.company_name,
          ai_output: aiOutput,
          benchmark_output: scenario.benchmark_output,
          score: score.score,
          passed: score.passed,
          criteria: score.criteria
        });
      } catch (err) {
        results.push({
          scenario_id: scenario.id,
          automation_type: scenario.automation_type,
          niche: scenario.niche,
          error: err.message,
          score: 0,
          passed: false
        });
      }
    }

    const avgScore = results.length > 0
      ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
      : 0;
    const passCount = results.filter(r => r.passed).length;

    send(res, 200, {
      ok: true,
      total: results.length,
      passed: passCount,
      failed: results.length - passCount,
      avg_score: avgScore,
      results
    });
    return;
  }

  // Scoring function
  function scoreAutomation(aiOutput, scenario) {
    const output = (aiOutput || '').trim();
    const benchmark = scenario.benchmark_output;
    const criteria = scenario.scoring_criteria;
    const isEmail = scenario.automation_type === 'quote_followup';
    const maxLen = isEmail ? 200 * 6 : 160; // 200 words or 160 chars
    const results = [];
    let totalScore = 0;

    for (const c of criteria) {
      let earned = 0;
      const out = output.toLowerCase();
      switch (true) {
        case /business name|company name/i.test(c.criterion):
          earned = out.includes(scenario.company_name.toLowerCase()) ? c.weight : 0;
          break;
        case /customer name|personalized/i.test(c.criterion):
          earned = out.includes(scenario.customer_name.toLowerCase().split(' ')[0].toLowerCase()) ? c.weight : 0;
          break;
        case /cta|call to action|call back/i.test(c.criterion):
          earned = /(call|book|reply|text|click|schedule|reschedule|visit|review|rate)/i.test(output) ? c.weight : 0;
          break;
        case /phone|contact/i.test(c.criterion):
          earned = /\(?\d{3}\)?[\s.-]?\d{3,4}|\d{10}/.test(output) || out.includes('call us') || out.includes('call back') ? c.weight : 0;
          break;
        case /tone|professional|warm|friendly|understanding|empath/i.test(c.criterion):
          // Check for negative/aggressive tone — if absent, award
          earned = !/stupid|idiot|dumb|why did you|you failed|you missed/i.test(output) ? c.weight : Math.round(c.weight * 0.5);
          break;
        case /urgency|urgent|emergency|asap|fast/i.test(c.criterion):
          earned = /(urgent|emergency|asap|right away|soon|now|immediately|don't wait|fast)/i.test(output) ? c.weight : 0;
          break;
        case /length|char|word|under \d+|concise|short/i.test(c.criterion):
          if (isEmail) {
            const words = output.split(/\s+/).length;
            earned = words <= 200 ? c.weight : Math.max(0, c.weight - (words - 200));
          } else {
            earned = output.length <= 160 ? c.weight : Math.max(0, c.weight - Math.ceil((output.length - 160) / 10));
          }
          break;
        case /niche|industry|service specific|hvac|roof|plumb|dental|legal/i.test(c.criterion):
          // Check if output mentions something niche-specific from the scenario
          const nicheKeywords = {
            HVAC: ['ac', 'cooling', 'heating', 'air', 'thermostat', 'furnace', 'heat'],
            Roofing: ['roof', 'shingle', 'leak', 'storm', 'inspection', 'gutter'],
            Plumbing: ['pipe', 'leak', 'drain', 'water', 'toilet', 'faucet', 'plumbing'],
            Dental: ['tooth', 'teeth', 'smile', 'cleaning', 'dental', 'appointment', 'cavity'],
            Legal: ['case', 'consultation', 'attorney', 'law', 'legal', 'court', 'claim']
          };
          const kws = nicheKeywords[scenario.niche] || [];
          earned = kws.some(k => out.includes(k)) ? c.weight : 0;
          break;
        case /respon|speed|quick|fast reply|prompt/i.test(c.criterion):
          earned = /(sorry|apolog|missed your|we saw|just saw|reaching out|following up|heard from)/i.test(output) ? c.weight : 0;
          break;
        case /incentive|financing|discount|offer|special|warranty|free/i.test(c.criterion):
          earned = /(financ|discount|offer|special|warranty|free|save|deal|premium)/i.test(output) ? c.weight : 0;
          break;
        case /next step|schedule|reschedule|book|restate|value/i.test(c.criterion):
          earned = /(schedule|reschedule|book|call|reply|confirm|available|appointment|set up)/i.test(output) ? c.weight : 0;
          break;
        case /subject line/i.test(c.criterion):
          earned = output.includes(':') || output.includes('Subject') || output.split('\n')[0].length < 60 ? c.weight : 0;
          break;
        default:
          // Generic: check if key terms from benchmark appear in output
          const benchmarkTerms = benchmark.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          const matchCount = benchmarkTerms.filter(t => out.includes(t)).length;
          earned = matchCount >= 3 ? c.weight : Math.round(c.weight * (matchCount / 3));
      }
      results.push({ criterion: c.criterion, weight: c.weight, earned, passed: earned >= c.weight * 0.7 });
      totalScore += earned;
    }

    totalScore = Math.min(100, Math.round(totalScore));
    return { score: totalScore, passed: totalScore >= 70, criteria: results };
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LifeOS Hermes Orchestrator (hybrid) listening on http://localhost:${PORT}`);
  console.log(`Coach -> ${FAST_MODEL} (direct, fast) | Site -> ${SMART_MODEL} (full Hermes)${LOW_CREDIT ? ' | LOW CREDIT' : ''}`);
  console.log(`OpenRouter key: ${OPENROUTER_KEY ? 'present' : 'MISSING — fast path will fail'}`);
});
