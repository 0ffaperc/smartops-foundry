// ===== AI Ops Agency — Standalone White-Themed App =====
// Stage 3B: Auth guard — check cookie-based session via /api/auth/me
// (no more localStorage sof_token — session is in an HttpOnly cookie)
(function() {
  // Quick check: fetch /me to see if we have a valid session
  // If not, the async loadUser below will redirect to login
})();

const API = '/api/agency';
const AUTH_API = '/api/auth';
let state = {
  clients: [], activeClient: null, clientData: null, catalog: {},
  tab: 'dashboard', busy: false, research: [],
  analysis: { intake: null, analyses: [], goals: [] },
  testLab: { type: 'missed_call', context: '', result: null, loading: false },
  drafting: {},
};

const CHANNEL_ICON = {
  sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
  both: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  none: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M9.937 15.5A2 2 0 0 0 12.007 15L19 8l-7 7a2 2 0 0 0-.063 2.5Z"/><path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"/></svg>',
};
const CHANNEL_CLASS = { sms: 'icon-bg-sky', email: 'icon-bg-violet', both: 'icon-bg-amber', none: 'icon-bg-accent' };
const CHANNEL_BADGE = { sms: 'badge-sky', email: 'badge-violet', both: 'badge-amber', none: 'badge-accent' };

const CATALOG_CATEGORY = {
  missed_call: 'Lead Capture', lead_welcome: 'Lead Capture', appt_reminder: 'Appointments', no_show: 'Appointments',
  quote_followup: 'Sales Pipeline', estimate_followup: 'Sales Pipeline', nurture_sequence: 'Sales Pipeline', upsell: 'Sales Pipeline',
  review_request: 'Reputation', review_response: 'Reputation', referral_request: 'Reputation', thank_you: 'Reputation',
  social_post: 'Marketing', gbp_update: 'Marketing', seasonal_campaign: 'Marketing', newsletter: 'Marketing',
  re_engagement: 'Retention', winback: 'Retention', birthday: 'Retention',
  weekly_report: 'Reporting', missed_revenue: 'Reporting', faq_responder: 'Customer Service',
  call_script: 'Call Automation', voicemail_followup: 'Call Automation', call_reminder: 'Call Automation', call_summary: 'Call Automation',
  multi_channel: 'Marketing Campaigns', content_calendar: 'Marketing Campaigns', ad_copy: 'Marketing Campaigns', promo_offer: 'Marketing Campaigns',
};
const CATEGORY_ORDER = ['Lead Capture','Appointments','Sales Pipeline','Reputation','Marketing','Retention','Customer Service','Reporting','Call Automation','Marketing Campaigns'];

function fmtTime(iso) { return iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function uid() { return 'id-' + Math.random().toString(36).slice(2, 11); }

// ===== Toast =====
function showToast(msg, type = 'info') {
  const root = document.getElementById('toastRoot');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = msg;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, 12px)'; setTimeout(() => t.remove(), 200); }, 3200);
}

// ===== API =====
async function api(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 401) { window.location.href = '/login.html'; return { ok: false, error: 'Authentication required' }; }
    return await r.json();
  } catch (e) { showToast('Connection error: ' + e.message, 'error'); return { ok: false, error: e.message }; }
}

// ===== Auth =====
// Stage 3B: cookie-based session — check /api/auth/me instead of localStorage token
async function loadUser() {
  try {
    const r = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
    const data = await r.json();
    if (data.ok && data.user) {
      const u = data.user;
      document.getElementById('userName').textContent = u.name || u.email;
      document.getElementById('userPlan').textContent = (u.plan || 'starter') + ' plan';
      document.getElementById('userAvatar').textContent = (u.name || u.email || '?').charAt(0).toUpperCase();
    } else {
      localStorage.removeItem('sof_token'); // clean up stale token if present
      localStorage.removeItem('sof_user');
      window.location.href = '/login.html';
    }
  } catch (e) {
    // Non-fatal — app may still work for some operations
    const saved = localStorage.getItem('sof_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        document.getElementById('userName').textContent = u.name || u.email;
        document.getElementById('userPlan').textContent = (u.plan || 'starter') + ' plan';
        document.getElementById('userAvatar').textContent = (u.name || u.email || '?').charAt(0).toUpperCase();
      } catch {}
    }
  }
}

function logout() {
  // Stage 3B: logout via cookie — server deletes session, clears cookie
  fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' }).catch(()=>{});
  localStorage.removeItem('sof_token');
  localStorage.removeItem('sof_user');
  window.location.href = '/login.html';
}

// ===== Init =====
async function init() {
  await loadUser();
  const cat = await api('/catalog');
  state.catalog = cat.catalog || {};
  await fetchClients();
  document.getElementById('backendStatus').textContent = '● Online';
  document.getElementById('backendStatus').style.color = 'var(--emerald)';
}
async function fetchClients() {
  const j = await api('/clients');
  state.clients = j.clients || [];
  if (!state.activeClient && state.clients.length) state.activeClient = state.clients[0].id;
  renderClientList();
  if (state.activeClient) fetchClientData();
}
async function fetchClientData() {
  if (!state.activeClient) return;
  const j = await api(`/clients/${state.activeClient}`);
  state.clientData = j.ok ? j : null;
  fetchResearch();
  fetchAnalysis();
  renderMain();
}
async function fetchResearch() {
  const j = await api(`/clients/${state.activeClient}/research`);
  state.research = j.research || [];
  if (state.tab === 'research') renderMain();
}
async function fetchAnalysis() {
  const j = await api(`/clients/${state.activeClient}/analysis`);
  state.analysis = j.analysis || { intake: null, analyses: [], goals: [] };
  if (state.tab === 'analysis') renderMain();
}

// ===== Client list render =====
function renderClientList() {
  const el = document.getElementById('clientList');
  if (!state.clients.length) {
    el.innerHTML = '<div class="empty" style="padding:32px 12px;"><p style="font-size:12px;">No clients yet.<br>Click "+ Add" to create one.</p></div>';
    return;
  }
  el.innerHTML = state.clients.map(c => `
    <div class="client-item ${state.activeClient === c.id ? 'active' : ''}" onclick="selectClient('${c.id}')">
      <div class="client-avatar">${esc(c.name?.slice(0, 2).toUpperCase())}</div>
      <div class="client-info">
        <div class="name">${esc(c.name)}</div>
        <div class="industry">${esc(c.industry)}</div>
      </div>
      <button class="client-delete" onclick="event.stopPropagation();deleteClient('${c.id}','${esc(c.name)}')" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`).join('');
}
function selectClient(id) { state.activeClient = id; state.tab = 'dashboard'; fetchClientData(); renderClientList(); }

// ===== Main render =====
function renderMain() {
  const p = state.clientData?.profile;
  const noClient = document.getElementById('noClient');
  const view = document.getElementById('clientView');
  if (!p) { noClient.classList.remove('hidden'); view.classList.add('hidden'); return; }
  noClient.classList.add('hidden'); view.classList.remove('hidden');
  const contacts = state.clientData?.contacts || [];
  const automations = state.clientData?.automations || [];
  const messages = state.clientData?.messages || [];
  view.innerHTML = `
    ${renderHeader(p)}
    ${renderTabs({ contacts: contacts.length, automations: automations.length, messages: messages.length })}
    <div class="card card-body" id="tabContent" style="border-top:none;border-radius:0 0 var(--radius) var(--radius);"></div>`;
  renderTab();
}
function renderHeader(p) {
  const smsOn = p.smsProvider?.sid;
  const emailOn = p.emailProvider?.host;
  return `<div class="page-header">
    <div class="avatar">${esc(p.name?.slice(0, 2).toUpperCase())}</div>
    <div><h2>${esc(p.name)}</h2><p>${esc(p.industry)} · ${esc(p.branding?.tone || 'friendly')} tone · ${esc(p.phone || 'no phone')}</p></div>
    <div class="badge-row">
      <span class="badge ${smsOn ? 'badge-on' : 'badge-off'}">${smsOn ? '✓ SMS' : 'SMS sim'}</span>
      <span class="badge ${emailOn ? 'badge-on' : 'badge-off'}">${emailOn ? '✓ Email' : 'Email sim'}</span>
    </div>
  </div>`;
}
function renderTabs(counts) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { id: 'testlab', label: 'Test Lab', icon: '<path d="M4 14a1 1 0 0 1-.78 1l-1 .44a1 1 0 0 0 0 1.12l1 .44a1 1 0 0 1 .78 1v.06a1 1 0 0 0 1.67.74l.05-.05a1 1 0 0 1 1.41 0l.05.05a1 1 0 0 0 1.67-.74V18a1 1 0 0 1 .78-1l1-.44a1 1 0 0 0 0-1.12L9.2 15a1 1 0 0 1-.78-1v-.06a1 1 0 0 0-1.67-.74l-.05.05a1 1 0 0 1-1.41 0l-.05-.05A1 1 0 0 0 4 13.94Z"/><path d="M18 2v6"/><path d="M22 8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V2h8z"/>' },
    { id: 'contacts', label: 'Contacts', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', count: counts.contacts },
    { id: 'automations', label: 'Automations', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/>', count: counts.automations },
    { id: 'messages', label: 'Messages', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', count: counts.messages },
    { id: 'research', label: 'Research', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>' },
    { id: 'analysis', label: 'Analysis', icon: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>' },
    { id: 'settings', label: 'Settings', icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  ];
  return `<div class="tabs">${tabs.map(t => `
    <button class="tab ${state.tab === t.id ? 'active' : ''}" onclick="setTab('${t.id}')">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg>
      ${t.label}${t.count != null ? `<span class="tab-count">${t.count}</span>` : ''}
    </button>`).join('')}</div>`;
}
function setTab(id) { state.tab = id; renderMain(); }
function renderTab() {
  const el = document.getElementById('tabContent');
  const p = state.clientData?.profile;
  const contacts = state.clientData?.contacts || [];
  const automations = state.clientData?.automations || [];
  const messages = state.clientData?.messages || [];
  const cat = state.catalog;
  switch (state.tab) {
    case 'dashboard': el.innerHTML = renderDashboard(contacts, automations, messages, cat); break;
    case 'testlab': el.innerHTML = renderTestLab(cat); break;
    case 'contacts': el.innerHTML = renderContacts(contacts, cat); break;
    case 'automations': el.innerHTML = renderAutomations(automations, cat); break;
    case 'messages': el.innerHTML = renderMessages(messages, contacts); break;
    case 'research': el.innerHTML = renderResearch(); break;
    case 'analysis': el.innerHTML = renderAnalysis(); break;
    case 'settings': el.innerHTML = renderSettings(p); break;
  }
}

// ===== Dashboard =====
function renderDashboard(contacts, automations, messages, catalog) {
  const drafts = messages.filter(m => m.status === 'draft');
  const sent = messages.filter(m => m.status === 'sent');
  const tags = [...new Set(contacts.flatMap(c => c.tags || []))];
  const stats = [
    { label: 'Contacts', value: contacts.length, cls: 'icon-bg-sky', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' },
    { label: 'Automations', value: automations.length, cls: 'icon-bg-violet', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/>' },
    { label: 'Drafts Pending', value: drafts.length, cls: 'icon-bg-amber', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' },
    { label: 'Messages Sent', value: sent.length, cls: 'icon-bg-emerald', icon: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>' },
  ];
  return `
    <div class="stat-grid">${stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon ${s.cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">${s.icon}</svg></div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('')}</div>
    <div class="grid-2">
      <div class="card card-body">
        <div class="section-head"><h3>Contact Tags</h3></div>
        ${tags.length ? `<div class="flex flex-wrap gap-2">${tags.map(t => `<span class="tag">${esc(t)} (${contacts.filter(c => c.tags?.includes(t)).length})</span>`).join('')}</div>` : '<p class="text-light" style="font-size:13px;">No tags yet</p>'}
      </div>
      <div class="card card-body">
        <div class="section-head"><h3>Automation Types (${Object.keys(catalog).length})</h3></div>
        <div class="flex flex-wrap gap-2">${Object.entries(catalog).map(([k, v]) => `<span class="chip">${CHANNEL_ICON[v.channel]||''}${esc(v.name)}</span>`).join('')}</div>
      </div>
    </div>
    ${drafts.length > 0 ? `<div class="info-banner info-amber">
      <div class="ib-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></div>
      <div class="flex-1"><h4>${drafts.length} draft(s) awaiting approval</h4><p>Go to the Messages tab to review & approve.</p></div>
    </div>` : ''}`;
}

// ===== Test Lab =====
function renderTestLab(catalog) {
  const cat = catalog[state.testLab.type] || {};
  return `
    <div class="info-banner info-violet">
      <div class="ib-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 14a1 1 0 0 1-.78 1l-1 .44a1 1 0 0 0 0 1.12l1 .44a1 1 0 0 1 .78 1v.06a1 1 0 0 0 1.67.74l.05-.05a1 1 0 0 1 1.41 0l.05.05a1 1 0 0 0 1.67-.74V18a1 1 0 0 1 .78-1l1-.44a1 1 0 0 0 0-1.12L9.2 15a1 1 0 0 1-.78-1v-.06a1 1 0 0 0-1.67-.74l-.05.05a1 1 0 0 1-1.41 0l-.05-.05A1 1 0 0 0 4 13.94Z"/><path d="M18 2v6"/><path d="M22 8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V2h8z"/></svg></div>
      <div class="flex-1"><h4>Automation Test Lab</h4><p>Instantly preview any automation — no contact needed, uses a test customer.</p></div>
    </div>
    <div class="card card-body">
      <div class="field">
        <label class="field-label">Automation Type</label>
        <select class="select" onchange="state.testLab.type=this.value;state.testLab.result=null;renderTab()">
          ${CATEGORY_ORDER.map(c => {
            const items = Object.entries(catalog).filter(([k]) => CATALOG_CATEGORY[k] === c);
            if (!items.length) return '';
            return `<optgroup label="${c}">${items.map(([k, v]) => `<option value="${k}" ${state.testLab.type === k ? 'selected' : ''}>${esc(v.name)} (${v.channel})</option>`).join('')}</optgroup>`;
          }).join('')}
        </select>
      </div>
      ${cat.desc ? `<div class="info-banner info-violet" style="padding:14px;margin-bottom:16px;">
        <div class="ib-icon" style="width:32px;height:32px;">${CHANNEL_ICON[cat.channel] || ''}</div>
        <div class="flex-1"><div class="flex gap-2 items-center mb-3" style="margin-bottom:4px;"><span class="badge ${CHANNEL_BADGE[cat.channel]}">${cat.channel}</span><span class="text-light" style="font-size:11px;">${esc(cat.trigger || '')}</span></div><p style="font-size:12px;">${esc(cat.desc)}</p></div>
      </div>` : ''}
      <div class="field">
        <label class="field-label">Context (optional JSON — e.g. {"offer": "$25 off"})</label>
        <input class="input text-mono" value="${esc(state.testLab.context)}" placeholder='{}' oninput="state.testLab.context=this.value">
      </div>
      <button class="btn btn-violet btn-block" onclick="runTestLab()" ${state.testLab.loading ? 'disabled' : ''}>
        ${state.testLab.loading ? '<span class="spinner spinner-sm"></span>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9.937 15.5A2 2 0 0 0 12.007 15L19 8l-7 7a2 2 0 0 0-.063 2.5Z"/><path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"/></svg>'} Generate Test Draft
      </button>
    </div>
    ${state.testLab.result ? `
      <div class="card card-body mt-4" style="border-color:#ddd6fe;box-shadow:0 4px 14px rgba(139,92,246,0.12);">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg><span style="font-size:14px;font-weight:700;">AI Draft Preview</span></div>
          <div class="flex gap-2"><span class="badge ${CHANNEL_BADGE[state.testLab.result.channel]}">${state.testLab.result.channel}</span><span class="badge badge-amber">${esc(state.testLab.result.status)}</span></div>
        </div>
        <pre class="msg-body text-mono" style="max-height:320px;">${esc(state.testLab.result.body)}</pre>
        <p class="text-light" style="font-size:11px;">→ Saved as a draft — go to the Messages tab to approve & send it.</p>
      </div>` : ''}`;
}
async function runTestLab() {
  state.testLab.loading = true; state.testLab.result = null; renderTab();
  try {
    let contactId;
    const contacts = state.clientData?.contacts || [];
    if (contacts.length > 0) { contactId = contacts[0].id; }
    else {
      const r = await api(`/clients/${state.activeClient}/contacts`, { method: 'POST', body: JSON.stringify({ name: 'Test Customer', phone: '+15555555555', email: 'test@example.com', tags: ['test'], notes: 'Test Lab contact' }) });
      contactId = r.contact?.id; await fetchClientData();
    }
    const r2 = await api(`/clients/${state.activeClient}/draft`, { method: 'POST', body: JSON.stringify({ contactId, automationType: state.testLab.type, context: state.testLab.context ? JSON.parse(state.testLab.context) : {} }) });
    if (r2.ok) { state.testLab.result = r2.message; showToast('Draft generated — review below', 'success'); }
    else showToast('Test failed: ' + (r2.error || ''), 'error');
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  state.testLab.loading = false; renderTab();
}

// ===== Contacts =====
function renderContacts(contacts, catalog) {
  return `
    <div class="section-head"><h3>${contacts.length} contacts</h3><button class="btn btn-sky btn-sm" onclick="openAddContact()">+ Add Contact</button></div>
    ${contacts.length === 0 ? `<div class="empty"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>No contacts yet.<br>Add one to start automating.</p></div>` : `
      <div class="flex" style="flex-direction:column;gap:12px;">
        ${contacts.map(c => `
          <div class="list-item">
            <div class="li-avatar">${esc(c.name?.slice(0, 1).toUpperCase())}</div>
            <div class="li-body">
              <div class="li-title">${esc(c.name)}</div>
              <div class="li-sub">
                ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
                ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
                <span style="text-transform:capitalize;">${esc(c.status)}</span>
              </div>
              ${c.tags?.length ? `<div class="tag-row">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
            </div>
            <button class="btn btn-violet btn-sm" onclick="openDraftPicker('${c.id}')" ${state.drafting[c.id] ? 'disabled' : ''}>
              ${state.drafting[c.id] ? '<span class="spinner spinner-sm"></span>' : '✨ Draft'}
            </button>
          </div>`).join('')}
      </div>`}`;
}

// ===== Automations =====
function renderAutomations(automations, catalog) {
  return `
    <div class="section-head"><h3>${automations.length} automations</h3><button class="btn btn-violet btn-sm" onclick="openAddAutomation()">+ New Automation</button></div>
    ${automations.length === 0 ? `<div class="empty"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/></svg><p>No automations yet.<br>Create one to batch-generate messages.</p></div>` : `
      <div class="flex" style="flex-direction:column;gap:12px;">
        ${automations.map(a => {
          const cat = catalog[a.type] || {};
          return `
          <div class="list-item">
            <div class="li-avatar ${CHANNEL_CLASS[cat.channel] || 'icon-bg-accent'}" style="background:var(--bg-soft);">${CHANNEL_ICON[cat.channel] || '⚙️'}</div>
            <div class="li-body">
              <div class="li-title">${esc(a.name)}</div>
              <div class="li-sub">${esc(cat.name || a.type)} · ${a.tags?.length ? `tags: ${esc(a.tags.join(', '))}` : 'all contacts'} · runs: ${a.runs || 0}</div>
            </div>
            <button class="btn btn-emerald btn-sm" onclick="runAutomation('${a.id}')" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? '<span class="spinner spinner-sm"></span>' : '▶ Run'}
            </button>
          </div>`;
        }).join('')}
      </div>`}`;
}
async function runAutomation(id) {
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/run-automation`, { method: 'POST', body: JSON.stringify({ automationId: id }) });
  state.busy = false;
  if (j.ok) { showToast(`Generated ${j.draftsGenerated} draft(s) — review in Messages`, 'success'); fetchClientData(); }
  else showToast('Run failed: ' + (j.error || ''), 'error');
}

// ===== Messages =====
function renderMessages(messages, contacts) {
  const name = id => contacts.find(c => c.id === id)?.name || 'Unknown';
  const sorted = [...messages].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return `
    <div class="section-head"><h3>${messages.length} messages</h3></div>
    ${sorted.length === 0 ? `<div class="empty"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>No messages yet.<br>Draft one from Contacts or run an Automation.</p></div>` : `
      <div class="flex" style="flex-direction:column;gap:14px;">
        ${sorted.map(m => {
          const statusBadge = m.status === 'sent' ? 'badge-on' : m.status === 'failed' ? 'badge-rose' : 'badge-amber';
          return `
          <div class="card card-body card-hover">
            <div class="flex items-center gap-2 mb-3">
              <div class="li-avatar ${CHANNEL_CLASS[m.channel] || 'icon-bg-sky'}" style="width:32px;height:32px;font-size:12px;">${CHANNEL_ICON[m.channel] || ''}</div>
              <span style="font-size:14px;font-weight:600;">${esc(name(m.contactId))}</span>
              <span class="badge ${statusBadge}">${esc(m.status)}</span>
              <span class="text-light" style="font-size:11px;margin-left:auto;">${fmtTime(m.timestamp)}</span>
            </div>
            <div class="msg-body">${esc(m.body)}</div>
            ${m.status === 'draft' ? `<button class="btn btn-emerald btn-sm" onclick="sendMsg('${m.id}')" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner spinner-sm"></span>' : '↗ Approve & Send'}</button>` : ''}
            ${m.sendResult?.simulated ? `<p style="font-size:11px;color:var(--amber);font-style:italic;margin-top:8px;">⚠ Simulated — no provider configured (see Settings)</p>` : ''}
            ${m.sendResult?.error ? `<p style="font-size:11px;color:var(--rose);margin-top:8px;">Error: ${esc(m.sendResult.error)}</p>` : ''}
          </div>`;
        }).join('')}
      </div>`}`;
}
async function sendMsg(id) {
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/send`, { method: 'POST', body: JSON.stringify({ messageId: id }) });
  state.busy = false;
  if (j.ok) { showToast(j.sendResult?.simulated ? 'Sent (SIMULATED)' : 'Sent!', 'success'); fetchClientData(); }
  else showToast('Send failed: ' + (j.error || ''), 'error');
}

// ===== Actions — Add Client / Contact / Automation =====
async function addClient(profile) {
  state.busy = true;
  const j = await api('/clients', { method: 'POST', body: JSON.stringify({ profile }) });
  state.busy = false;
  if (j.ok) { showToast(`Client "${profile.name}" created`, 'success'); closeModal(); await fetchClients(); state.activeClient = j.id; fetchClientData(); }
  else showToast('Create failed: ' + (j.error || ''), 'error');
}
async function addContact(contact) {
  const j = await api(`/clients/${state.activeClient}/contacts`, { method: 'POST', body: JSON.stringify(contact) });
  if (j.ok) { showToast(`Contact "${contact.name}" added`, 'success'); closeModal(); fetchClientData(); }
}
async function addAutomation(auto) {
  const j = await api(`/clients/${state.activeClient}/automations`, { method: 'POST', body: JSON.stringify(auto) });
  if (j.ok) { showToast(`Automation "${auto.name}" created`, 'success'); closeModal(); fetchClientData(); }
}
async function deleteClient(id, name) {
  if (!confirm(`Delete "${name}" and ALL its data?`)) return;
  const j = await api(`/clients/${id}`, { method: 'DELETE' });
  if (j.ok) { showToast(`Deleted "${name}"`, 'success'); state.activeClient = null; await fetchClients(); }
}
async function draftMsg(contactId, type, context) {
  state.drafting[contactId] = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/draft`, { method: 'POST', body: JSON.stringify({ contactId, automationType: type, context }) });
  state.drafting[contactId] = false;
  if (j.ok) { showToast('Draft generated — review & approve in Messages', 'success'); closeModal(); fetchClientData(); }
  else showToast('Draft failed: ' + (j.error || ''), 'error');
}

// ===== Research =====
function renderResearch() {
  return `
    <div class="info-banner info-sky">
      <div class="ib-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg></div>
      <div class="flex-1"><h4>Competitor Research</h4><p>AI searches the web, ranks competitors, finds market gaps, and recommends moves.</p></div>
    </div>
    <div class="card card-body mb-4">
      <div class="field">
        <label class="field-label">Research Prompt</label>
        <textarea class="textarea" id="researchPrompt" placeholder="e.g. Find HVAC companies in Dallas TX and compare them to us"></textarea>
      </div>
      <button class="btn btn-sky btn-block" onclick="runResearch()" ${state.busy ? 'disabled' : ''}>
        ${state.busy ? '<span class="spinner spinner-sm"></span>' : '🔍 Run Research'}
      </button>
    </div>
    ${state.research.length === 0 ? `<div class="empty"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg><p>No research yet.<br>Run your first competitor analysis above.</p></div>` : state.research.map(r => `
      <div class="card card-body card-hover mb-4">
        <div class="flex items-center justify-between mb-3" style="padding-bottom:12px;border-bottom:1px solid var(--border);">
          <span style="font-size:14px;font-weight:600;">${esc(r.prompt)}</span>
          <span class="text-light" style="font-size:12px;">${new Date(r.date).toLocaleDateString()}</span>
        </div>
        ${r.competitors?.length ? `<div class="mb-4"><div class="cat-label" style="color:var(--sky);">Competitors (${r.competitors.length})</div><div class="flex" style="flex-direction:column;gap:8px;">${r.competitors.map((c, i) => `
          <div class="card card-body-sm" style="background:var(--bg-soft);">
            <div class="flex items-center justify-between mb-3" style="margin-bottom:4px;"><span style="font-size:13px;font-weight:600;">${esc(c.name)}</span>${c.rating ? `<span style="color:var(--amber);font-weight:700;font-size:13px;">${esc(c.rating)}★</span>` : ''}</div>
            <p style="font-size:12px;color:var(--emerald);margin-bottom:2px;">✓ ${esc(c.strengths)}</p>
            <p style="font-size:12px;color:var(--rose);">✗ ${esc(c.weaknesses)}</p>
          </div>`).join('')}</div></div>` : ''}
        ${r.marketGaps?.length ? `<div class="mb-4"><div class="cat-label" style="color:var(--amber);">Market Gaps</div><ul style="list-style:none;">${r.marketGaps.map(g => `<li style="font-size:13px;color:var(--text-mid);padding:3px 0;padding-left:18px;position:relative;"><span style="position:absolute;left:0;color:var(--amber);">▸</span>${esc(g)}</li>`).join('')}</ul></div>` : ''}
        ${r.recommendations?.length ? `<div><div class="cat-label" style="color:var(--emerald);">Recommended Moves</div><ul style="list-style:none;">${r.recommendations.map(g => `<li style="font-size:13px;color:#047857;padding:3px 0;padding-left:18px;position:relative;"><span style="position:absolute;left:0;color:var(--emerald);">→</span>${esc(g)}</li>`).join('')}</ul></div>` : ''}
        ${r.searchResults?.length ? `<hr class="divider"><p class="text-light" style="font-size:11px;">${r.searchResults.length} web sources found</p>` : ''}
      </div>`).join('')}`;
}
async function runResearch() {
  const prompt = document.getElementById('researchPrompt').value.trim();
  if (!prompt) return;
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/research`, { method: 'POST', body: JSON.stringify({ prompt }) });
  state.busy = false;
  if (j.ok) { showToast('Research complete', 'success'); fetchResearch(); }
  else showToast('Research failed: ' + (j.error || ''), 'error');
}

// ===== Analysis =====
function renderAnalysis() {
  const intake = state.analysis.intake;
  const latest = state.analysis.analyses?.[0];
  const goals = state.analysis.goals || [];
  if (!intake) return renderIntakeForm();
  return `
    <div class="info-banner info-emerald">
      <div class="ib-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg></div>
      <div class="flex-1"><h4>Business Analysis</h4><p>Revenue: $${esc(intake.revenue)}/mo · Leads: ${esc(intake.leadVolume)}/mo · Close: ${esc(intake.closeRate)}% · Goal: ${esc(intake.goal12mo)}</p></div>
      <button class="btn btn-ghost btn-sm" onclick="state.analysis.intake=null;renderTab()">Edit Intake</button>
    </div>
    ${!latest ? `<div class="card card-body">
      <button class="btn btn-emerald btn-block" onclick="runAnalysis()" ${state.busy ? 'disabled' : ''}>
        ${state.busy ? '<span class="spinner spinner-sm"></span>' : '✨ Run Full Business Analysis'}
      </button>
      <p class="text-light mt-3" style="font-size:12px;text-align:center;">The AI will generate a SWOT, set 4-6 benchmark goals with daily/weekly/monthly action plans.</p>
    </div>` : `
      <div class="card card-body mb-4">
        <div class="flex items-center gap-2 mb-3"><span style="color:var(--emerald);">✨</span><span class="cat-label" style="margin:0;color:var(--emerald);">AI Summary</span></div>
        <p style="font-size:14px;color:var(--text-mid);line-height:1.6;">${esc(latest.summary)}</p>
      </div>
      ${latest.swot ? `<div class="swot-grid">
        ${['strengths','weaknesses','opportunities','threats'].map(k => `
          <div class="swot-card swot-${k[0]}"><h5>${k}</h5><ul>${(latest.swot[k] || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('')}
      </div>` : ''}
      <div class="section-head" style="margin-top:20px;"><h3>Growth Goals (${goals.length})</h3><button class="btn btn-emerald btn-sm" onclick="runProgressLoop()" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner spinner-sm"></span>' : '↻ Run Progress Loop'}</button></div>
      <div class="flex" style="flex-direction:column;gap:12px;">
        ${goals.map(g => {
          const pBadge = g.priority === 'high' ? 'badge-rose' : g.priority === 'medium' ? 'badge-amber' : 'badge-off';
          const stColor = g.status === 'stagnant' ? 'var(--rose)' : g.status === 'declining' ? 'var(--rose)' : 'var(--emerald)';
          return `
          <div class="card card-body card-hover">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2"><span class="badge ${pBadge}">${esc(g.priority)}</span><span style="font-size:14px;font-weight:600;">${esc(g.title)}</span></div>
              <span class="tag">${esc(g.category)}</span>
            </div>
            <div class="progress-row mb-3">
              <div class="progress-track"><div class="progress-fill" style="width:${g.progressPct || 0}%"></div></div>
              <span class="progress-label">${g.progressPct || 0}%</span>
            </div>
            <div class="flex gap-3 mb-3" style="font-size:12px;color:var(--text-light);"><span>Current: <strong style="color:var(--text-mid);">${esc(g.current)}</strong></span><span>→</span><span>Target: <strong style="color:var(--text-mid);">${esc(g.target)}</strong></span></div>
            ${g.gap ? `<p style="font-size:12px;color:var(--amber);background:var(--amber-bg);padding:8px 12px;border-radius:8px;margin-bottom:12px;">⚠ Gap: ${esc(g.gap)}</p>` : ''}
            ${g.actions ? `<div class="grid-3">${['daily','weekly','monthly'].map(freq => `
              <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;padding:10px;">
                <div class="cat-label" style="margin:0 0 6px;">${freq}</div>
                <ul style="list-style:none;">${(g.actions[freq] || []).map(a => `<li style="font-size:11px;color:var(--text-mid);padding:2px 0;padding-left:12px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;opacity:0.4;">•</span>${esc(a)}</li>`).join('')}</ul>
              </div>`).join('')}</div>` : ''}
            ${g.status ? `<p style="font-size:12px;display:flex;align-items:center;gap:6px;color:${stColor};margin-top:10px;"><span style="width:8px;height:8px;border-radius:50%;background:${stColor};display:inline-block;"></span>${esc(g.status)}${g.lastNote ? ' — ' + esc(g.lastNote) : ''}</p>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-emerald btn-block mt-4" onclick="runAnalysis()" ${state.busy ? 'disabled' : ''}>
        ${state.busy ? '<span class="spinner spinner-sm"></span>' : '↻ Re-run Full Analysis'}
      </button>
    `}`;
}
function renderIntakeForm() {
  const Q = [
    { id: 'revenue', label: 'Monthly Revenue ($)', ph: '45000' },
    { id: 'costs', label: 'Monthly Costs ($)', ph: '30000' },
    { id: 'employees', label: 'Number of Employees', ph: '5' },
    { id: 'hours', label: 'Hours of Operation', ph: 'Mon-Fri 8am-6pm' },
    { id: 'niche', label: 'Business Niche / Services', ph: 'HVAC repair, installation' },
    { id: 'leadVolume', label: 'Monthly Leads', ph: '80' },
    { id: 'closeRate', label: 'Close Rate (%)', ph: '35' },
    { id: 'avgJob', label: 'Average Job Value ($)', ph: '650' },
    { id: 'reviews', label: 'Google Reviews (count + rating)', ph: '47 reviews, 4.2 stars' },
    { id: 'seasonality', label: 'Seasonality / Busy Months', ph: 'Summer peak, winter slow' },
    { id: 'topChannel', label: 'Top Lead Source', ph: 'Google, word of mouth' },
    { id: 'biggestChallenge', label: 'Biggest Challenge', ph: 'Slow in winter' },
    { id: 'goal12mo', label: '12-Month Goal', ph: 'Double revenue' },
  ];
  return `
    <div class="info-banner info-emerald">
      <div class="ib-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg></div>
      <div class="flex-1"><h4>Business Intake Questionnaire</h4><p>The AI needs this data to do a complete analysis. The more accurate, the better the goals.</p></div>
    </div>
    <div class="card card-body">
      <div class="grid-2" style="margin-bottom:0;">
        ${Q.map(q => `<div class="field" style="margin-bottom:14px;"><label class="field-label">${q.label}</label><input class="input" id="intake_${q.id}" placeholder="${q.ph}" value="${esc(state.analysis.intake?.[q.id] || '')}"></div>`).join('')}
      </div>
      <button class="btn btn-emerald btn-block" onclick="saveIntake()" ${state.busy ? 'disabled' : ''}>
        ${state.busy ? '<span class="spinner spinner-sm"></span>' : '✓ Save Business Data'}
      </button>
    </div>`;
}
async function saveIntake() {
  const Q = ['revenue','costs','employees','hours','niche','leadVolume','closeRate','avgJob','reviews','seasonality','topChannel','biggestChallenge','goal12mo'];
  const intake = {}; Q.forEach(id => intake[id] = (document.getElementById('intake_' + id)?.value || '').trim());
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/intake`, { method: 'POST', body: JSON.stringify(intake) });
  state.busy = false;
  if (j.ok) { showToast('Business data saved', 'success'); await fetchAnalysis(); state.analysis.intake = intake; renderTab(); }
  else showToast('Save failed: ' + (j.error || ''), 'error');
}
async function runAnalysis() {
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/analyze`, { method: 'POST', body: JSON.stringify({}) });
  state.busy = false;
  if (j.ok) { showToast('Analysis complete — see goals below', 'success'); await fetchAnalysis(); renderTab(); }
  else showToast('Analysis failed: ' + (j.error || ''), 'error');
}
async function runProgressLoop() {
  state.busy = true; renderTab();
  const j = await api(`/clients/${state.activeClient}/progress-loop`, { method: 'POST', body: JSON.stringify({}) });
  state.busy = false;
  if (j.ok) { showToast('Progress updated', 'success'); await fetchAnalysis(); renderTab(); }
  else showToast('Loop failed: ' + (j.error || ''), 'error');
}

// ===== Settings =====
function renderSettings(p) {
  const sp = p.smsProvider || {}; const ep = p.emailProvider || {};
  return `
    <p class="text-mid mb-4" style="font-size:13px;">Provider Settings — connect to send real SMS/Email. Leave blank for simulation mode.</p>
    <div class="grid-2 mb-4">
      <div class="card card-body">
        <div class="flex items-center gap-2 mb-4"><div class="ib-icon icon-bg-sky" style="width:36px;height:36px;border-radius:10px;">${CHANNEL_ICON.sms}</div><span style="font-size:14px;font-weight:700;">SMS (Twilio)</span></div>
        <div class="field"><label class="field-label">Account SID</label><input class="input" id="sp_sid" value="${esc(sp.sid || '')}" placeholder="Account SID"></div>
        <div class="field"><label class="field-label">Auth Token</label><input class="input" id="sp_token" type="password" value="${esc(sp.token || '')}" placeholder="Auth Token"></div>
        <div class="field" style="margin-bottom:0;"><label class="field-label">From Number</label><input class="input" id="sp_from" value="${esc(sp.fromNumber || '')}" placeholder="+1..."></div>
      </div>
      <div class="card card-body">
        <div class="flex items-center gap-2 mb-4"><div class="ib-icon icon-bg-violet" style="width:36px;height:36px;border-radius:10px;">${CHANNEL_ICON.email}</div><span style="font-size:14px;font-weight:700;">Email (SMTP)</span></div>
        <div class="field"><label class="field-label">SMTP Host</label><input class="input" id="ep_host" value="${esc(ep.host || '')}" placeholder="smtp.gmail.com"></div>
        <div class="field"><label class="field-label">Port</label><input class="input" id="ep_port" value="${esc(ep.port || '')}" placeholder="587"></div>
        <div class="field"><label class="field-label">Username</label><input class="input" id="ep_user" value="${esc(ep.user || '')}" placeholder="Username"></div>
        <div class="field"><label class="field-label">Password</label><input class="input" id="ep_pass" type="password" value="${esc(ep.pass || '')}" placeholder="App Password"></div>
        <div class="field" style="margin-bottom:0;"><label class="field-label">From Email</label><input class="input" id="ep_from" value="${esc(ep.from || '')}" placeholder="you@business.com"></div>
      </div>
    </div>
    <button class="btn btn-primary" onclick="saveProviders()" ${state.busy ? 'disabled' : ''}>
      ${state.busy ? '<span class="spinner spinner-sm"></span>' : '💾 Save Providers'}
    </button>`;
}
async function saveProviders() {
  const smsProvider = { sid: v('sp_sid'), token: v('sp_token'), fromNumber: v('sp_from') };
  const emailProvider = { host: v('ep_host'), port: v('ep_port'), user: v('ep_user'), pass: v('ep_pass'), from: v('ep_from') };
  state.busy = true;
  const j = await api(`/clients/${state.activeClient}`, { method: 'PUT', body: JSON.stringify({ smsProvider, emailProvider }) });
  state.busy = false;
  if (j.ok) { showToast('Providers saved', 'success'); fetchClientData(); }
  else showToast('Save failed: ' + (j.error || ''), 'error');
}
function v(id) { return document.getElementById(id)?.value.trim() || ''; }

// ===== Modals =====
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }
function modalShell(title, body) {
  return `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div><div class="modal-body">${body}</div></div></div>`;
}
function openAddClient() {
  const industries = ['hvac','roofing','plumbing','dental','legal','real-estate','fitness','restaurant','auto','salon','general'];
  document.getElementById('modalRoot').innerHTML = modalShell('Add Client Business', `
    <div class="field"><label class="field-label">Business Name</label><input class="input" id="cl_name" placeholder="Acme HVAC"></div>
    <div class="field"><label class="field-label">Industry</label><select class="select" id="cl_industry">${industries.map(i => `<option value="${i}">${i}</option>`).join('')}</select></div>
    <div class="field"><label class="field-label">Business Phone</label><input class="input" id="cl_phone" placeholder="5551234567"></div>
    <div class="field"><label class="field-label">Brand Tone</label><select class="select" id="cl_tone"><option>friendly</option><option>professional</option><option>casual</option><option>formal</option></select></div>
    <button class="btn btn-primary btn-block" onclick="addClient({name:gv('cl_name'),industry:gv('cl_industry'),phone:gv('cl_phone'),branding:{tone:gv('cl_tone')}})" ${state.busy ? 'disabled' : ''}>+ Create Client</button>`);
}
function openAddContact() {
  document.getElementById('modalRoot').innerHTML = modalShell('Add Contact', `
    <div class="field"><label class="field-label">Name</label><input class="input" id="co_name" placeholder="John Smith"></div>
    <div class="field"><label class="field-label">Phone</label><input class="input" id="co_phone" placeholder="5550000"></div>
    <div class="field"><label class="field-label">Email</label><input class="input" id="co_email" placeholder="john@email.com"></div>
    <div class="field"><label class="field-label">Tags (comma-separated)</label><input class="input" id="co_tags" placeholder="lead, customer"></div>
    <button class="btn btn-sky btn-block" onclick="addContact({name:gv('co_name'),phone:gv('co_phone'),email:gv('co_email'),tags:gv('co_tags').split(',').map(t=>t.trim()).filter(Boolean),status:'new'})">+ Add Contact</button>`);
}
function openAddAutomation() {
  const cat = state.catalog;
  document.getElementById('modalRoot').innerHTML = modalShell('New Automation', `
    <div class="field"><label class="field-label">Automation Name</label><input class="input" id="au_name" placeholder="Post-Job Review Request"></div>
    <div class="field"><label class="field-label">Type</label><select class="select" id="au_type" onchange="document.getElementById('au_name').value=document.getElementById('au_name').value||this.options[this.selectedIndex].text.split(' (')[0]">${CATEGORY_ORDER.map(c => {
      const items = Object.entries(cat).filter(([k]) => CATALOG_CATEGORY[k] === c);
      return items.length ? `<optgroup label="${c}">${items.map(([k, v]) => `<option value="${k}">${esc(v.name)} (${v.channel})</option>`).join('')}</optgroup>` : '';
    }).join('')}</select></div>
    <div class="field"><label class="field-label">Target Tags (comma-separated, blank = all)</label><input class="input" id="au_tags" placeholder="customer"></div>
    <button class="btn btn-violet btn-block" onclick="addAutomation({name:gv('au_name'),type:gv('au_type'),channel:(state.catalog[gv('au_type')]||{}).channel,tags:gv('au_tags').split(',').map(t=>t.trim()).filter(Boolean)})">+ Create Automation</button>`);
}
function openDraftPicker(contactId) {
  const cat = state.catalog; let picked = null;
  document.getElementById('modalRoot').innerHTML = modalShell('Draft Message', `
    <p class="text-mid mb-3" style="font-size:12px;">Pick an automation type. AI will draft a personalized message (you'll approve before sending).</p>
    <div style="max-height:360px;overflow-y:auto;">
      ${CATEGORY_ORDER.map(c => {
        const items = Object.entries(cat).filter(([k]) => CATALOG_CATEGORY[k] === c);
        return items.length ? `<div class="cat-label">${c}</div>${items.map(([k, v]) => `
          <button class="auto-pick" id="dp_${k}" onclick="picked='${k}';document.querySelectorAll('.auto-pick').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')">
            <div class="ap-icon ${CHANNEL_CLASS[v.channel]}">${CHANNEL_ICON[v.channel] || '⚙️'}</div>
            <div><div class="ap-title">${esc(v.name)}</div><div class="ap-desc">${esc(v.desc)}</div></div>
          </button>`).join('')}` : '';
      }).join('')}
    </div>
    <button class="btn btn-violet btn-block mt-3" onclick="if(window.picked){draftMsg('${contactId}',window.picked,{});window.picked=null}else showToast('Pick an automation first','error')">✨ Generate Draft</button>`);
  window.picked = null;
}
function gv(id) { return (document.getElementById(id)?.value || '').trim(); }

// ===== Start =====
init();
