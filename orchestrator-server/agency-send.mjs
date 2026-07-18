// agency-send.mjs — Message drafting, sending (Twilio SMS / SMTP email), conversation logging.
import { readJSON, writeJSON, join, uid, nowISO, aiDraft, CLIENTS_DIR, ensureDir, AUTOMATION_CATALOG } from './agency.mjs';

// ---- Contact CRUD ----
function listContacts(clientId) {
  return readJSON(join(CLIENTS_DIR, clientId, 'contacts.json'), []);
}
function addContact(clientId, contact) {
  const path = join(CLIENTS_DIR, clientId, 'contacts.json');
  const list = readJSON(path, []);
  const c = { id: uid(), created: nowISO(), status: 'new', tags: [], notes: '', ...contact };
  list.push(c);
  writeJSON(path, list);
  return c;
}
function updateContact(clientId, contactId, updates) {
  const path = join(CLIENTS_DIR, clientId, 'contacts.json');
  const list = readJSON(path, []);
  const c = list.find(x => x.id === contactId);
  if (!c) return null;
  Object.assign(c, updates);
  writeJSON(path, list);
  return c;
}
function deleteContact(clientId, contactId) {
  const path = join(CLIENTS_DIR, clientId, 'contacts.json');
  const list = readJSON(path, []).filter(x => x.id !== contactId);
  writeJSON(path, list);
  return true;
}

// ---- Automation CRUD ----
function listAutomations(clientId) {
  return readJSON(join(CLIENTS_DIR, clientId, 'automations.json'), []);
}
function addAutomation(clientId, auto) {
  const path = join(CLIENTS_DIR, clientId, 'automations.json');
  const list = readJSON(path, []);
  const a = { id: uid(), created: nowISO(), active: true, runs: 0, ...auto };
  list.push(a);
  writeJSON(path, list);
  return a;
}
function updateAutomation(clientId, autoId, updates) {
  const path = join(CLIENTS_DIR, clientId, 'automations.json');
  const list = readJSON(path, []);
  const a = list.find(x => x.id === autoId);
  if (!a) return null;
  Object.assign(a, updates);
  writeJSON(path, list);
  return a;
}
function deleteAutomation(clientId, autoId) {
  const path = join(CLIENTS_DIR, clientId, 'automations.json');
  const list = readJSON(path, []).filter(x => x.id !== autoId);
  writeJSON(path, list);
  return true;
}

// ---- Templates ----
function listTemplates(clientId) {
  return readJSON(join(CLIENTS_DIR, clientId, 'templates.json'), []);
}
function addTemplate(clientId, tpl) {
  const path = join(CLIENTS_DIR, clientId, 'templates.json');
  const list = readJSON(path, []);
  const t = { id: uid(), ...tpl };
  list.push(t);
  writeJSON(path, list);
  return t;
}

// ---- Messages / conversation log ----
function logMessage(clientId, msg) {
  const path = join(CLIENTS_DIR, clientId, 'messages.json');
  const list = readJSON(path, []);
  const m = { id: uid(), timestamp: nowISO(), status: 'draft', ...msg };
  list.push(m);
  writeJSON(path, list);
  return m;
}
function updateMessage(clientId, msgId, updates) {
  const path = join(CLIENTS_DIR, clientId, 'messages.json');
  const list = readJSON(path, []);
  const m = list.find(x => x.id === msgId);
  if (!m) return null;
  Object.assign(m, updates);
  writeJSON(path, list);
  return m;
}
function listMessages(clientId, contactId) {
  const list = readJSON(join(CLIENTS_DIR, clientId, 'messages.json'), []);
  if (contactId) return list.filter(m => m.contactId === contactId).sort((a,b) => (a.timestamp||'').localeCompare(b.timestamp||''));
  return list.sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''));
}

// ---- AI Message Drafting ----
// Generates a personalized message for a contact + automation type.
async function draftMessage(client, contact, automationType, context) {
  const tone = client.branding?.tone || 'friendly';
  const cat = AUTOMATION_CATALOG[automationType] || {};
  const fmtHint = automationType === 'social_post'
    ? ' Output as: CAPTION: <caption under 220 chars>\\n\\nHASHTAGS: <8-12 relevant hashtags>'
    : automationType === 'gbp_update'
    ? ' Output as: TITLE: <under 50 chars>\\n\\nBODY: <2-3 sentences, no hashtags>'
    : automationType === 'review_response'
    ? ' Write a public reply to a Google review. Thank them by name, address specific feedback, invite them back. 2-3 sentences. If negative, acknowledge + offer to make it right. Output ONLY the reply text.'
    : automationType === 'weekly_report'
    ? ' Write a Monday performance email to the owner. Output as: SUBJECT: <subject>\\n\\n<body with a short bullet list of this week key metrics and 1 recommendation>'
    : ' Output ONLY the message text (for email: "SUBJECT: <subject>\\n\\n<body>").';
  const sys = `You are an AI assistant for ${client.name}, a ${client.industry} business. Write a ${automationType} (${cat.desc || ''}). Tone: ${tone}. For SMS keep under 160 chars (1 segment). Be personal, warm, specific. Use {{contact_name}} placeholder sparingly — the system fills it. Never invent facts about the business not given.${fmtHint}`;
  const ctxStr = context ? `\\nContext: ${JSON.stringify(context)}` : '';
  const user = `Customer: ${contact.name}${contact.phone ? ', phone ' + contact.phone : ''}${contact.email ? ', email ' + contact.email : ''}. Tags: ${(contact.tags||[]).join(', ') || 'none'}. Notes: ${contact.notes || 'none'}. Automation: ${automationType}.${ctxStr}`;
  return await aiDraft(sys, user, 500);
}

// ---- Senders ----
// Twilio SMS
async function sendTwilio(sid, token, from, to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(sid + ':' + token).toString('base64');
  const form = new URLSearchParams();
  form.append('To', to); form.append('From', from); form.append('Body', body);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const j = await r.json();
  return { ok: r.ok, sid: j.sid, error: j.message || null };
}

// SMTP email via Node built-in (no external dep — uses raw SMTP over TLS socket)
async function sendSMTP(cfg, to, subject, body) {
  return new Promise(async (resolve) => {
    const { host, port, user, pass, from } = cfg;
    try {
      const tls = await import('node:tls');
      const socket = tls.connect({ host, port: parseInt(port) || 587 }, () => {
        let step = 0;
        const cmds = [
          `EHLO localhost\r\n`,
          `AUTH LOGIN\r\n`,
          Buffer.from(user).toString('base64') + '\r\n',
          Buffer.from(pass).toString('base64') + '\r\n',
          `MAIL FROM:<${from}>\r\n`,
          `RCPT TO:<${to}>\r\n`,
          `DATA\r\n`,
          `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.\r\n`,
          `QUIT\r\n`,
        ];
        socket.write(cmds[0]);
        let buf = '';
        socket.on('data', (d) => {
          buf += d.toString();
          if (buf.includes('\r\n')) {
            if (step < cmds.length - 1) { step++; socket.write(cmds[step]); buf = ''; }
            else { socket.end(); resolve({ ok: true }); }
          }
        });
      });
      socket.setTimeout(15000);
      socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, error: 'SMTP timeout' }); });
      socket.on('error', (e) => resolve({ ok: false, error: String(e) }));
    } catch (e) { resolve({ ok: false, error: String(e) }); }
  });
}

// Simulation (no provider configured) — records what WOULD be sent
function simulate(channel, to, body) {
  return { ok: true, simulated: true, note: `SIMULATED ${channel} to ${to}: "${body.slice(0,80)}..." (configure provider to send for real)` };
}

// ---- Dispatch: draft + log (as 'draft' status). Approval gate: caller sets status to 'sent' after send. ----
export {
  listContacts, addContact, updateContact, deleteContact,
  listAutomations, addAutomation, updateAutomation, deleteAutomation,
  listTemplates, addTemplate,
  logMessage, updateMessage, listMessages,
  draftMessage, sendTwilio, sendSMTP, simulate,
};
