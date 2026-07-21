// SmartOps Foundry — Client Portal App
// Completely different from agency dashboard — no clients tab, unique UI per tab

const AUTH_API = '/api/auth';
const AGENCY_API = '/api/agency';
let userData = null;
let clientData = null;
let activeTab = 'leads';
const charts = {};

// ---- Automation groups (30 types reorganized into 5 tabs) ----
const AUTOMATION_GROUPS = {
  leads: {
    label: 'Lead Generation',
    types: ['missed_call', 'lead_welcome', 'quote_followup', 'estimate_followup', 'nurture_sequence', 'faq_responder'],
    icon: '📡',
    chatSystem: 'You are the Leads Assistant for SmartOps Foundry. Help the client understand lead capture automations (missed call text-back, lead welcome, quote follow-up, estimate follow-up, nurture sequences, FAQ auto-responder). Explain how each automation works, suggest improvements, and answer questions about lead conversion. Be concise and practical.'
  },
  marketing: {
    label: 'Marketing & Research',
    types: ['social_post', 'gbp_update', 'seasonal_campaign', 'newsletter', 'multi_channel', 'content_calendar', 'ad_copy', 'promo_offer', 'faq_responder'],
    icon: '📊',
    chatSystem: 'You are the Marketing Assistant for SmartOps Foundry. Help with marketing campaigns, social media posts, Google Business Profile updates, seasonal campaigns, newsletters, multi-channel marketing, content calendars, ad copy, and promotional offers. Suggest strategies and explain how automations work. Be practical and actionable.'
  },
  goals: {
    label: 'Goals & Reputation',
    types: ['review_request', 'review_response', 'referral_request', 'thank_you', 're_engagement', 'winback', 'birthday', 'upsell'],
    icon: '🎯',
    chatSystem: 'You are the Goals Assistant for SmartOps Foundry. Help the client set and track goals for online reviews, review responses, referral requests, customer thank-yous, re-engagement campaigns, win-back sequences, birthday messages, and upselling. Explain how reputation automations work and suggest strategies to improve ratings and retention. Be encouraging and specific.'
  },
  schedule: {
    label: 'Scheduling & Appointments',
    types: ['appt_reminder', 'no_show', 'call_script', 'voicemail_followup', 'call_reminder', 'call_summary'],
    icon: '📅',
    chatSystem: 'You are the Schedule Assistant for SmartOps Foundry. Help with appointment reminders, no-show recovery, call scripts, voicemail follow-up, call reminders, and call summaries. Suggest strategies to reduce no-shows and improve scheduling efficiency. Be practical and concise.'
  },
  reports: {
    label: 'Reports & Analytics',
    types: ['weekly_report', 'missed_revenue'],
    icon: '📈',
    chatSystem: 'You are the Reports Assistant for SmartOps Foundry. Help the client understand weekly reports, missed revenue alerts, and overall analytics. Explain what metrics matter, how to read charts, and what actions to take based on data. Be clear and analytical.'
  },
};

// ---- Init ----
async function init() {
  await loadUser();
  await loadClientData();
  renderAll();
  // Initialize first tab chart
  setTimeout(() => renderCharts('leads'), 100);
}

async function loadUser() {
  try {
    const r = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
    const d = await r.json();
    if (d.ok && d.user) {
      userData = d.user;
      document.getElementById('userName').textContent = d.user.name || d.user.email;
      document.getElementById('userPlan').textContent = (d.user.plan || 'starter') + ' plan';
      document.getElementById('userAvatar').textContent = (d.user.name || '?').charAt(0).toUpperCase();
    } else {
      window.location.href = '/login.html?redirect=/client.html';
    }
  } catch (e) {
    window.location.href = '/login.html?redirect=/client.html';
  }
}

async function loadClientData() {
  try {
    const r = await fetch(`${AGENCY_API}/clients`, { credentials: 'include' });
    const d = await r.json();
    const clients = d.clients || [];
    if (clients.length === 0) {
      document.getElementById('bizName').textContent = 'No business connected';
      return;
    }
    // Use first client (or saved selection)
    const clientId = localStorage.getItem('sof_clientId') || clients[0].id;
    const client = clients.find(c => c.id === clientId) || clients[0];
    localStorage.setItem('sof_clientId', client.id);
    document.getElementById('bizName').textContent = client.name || 'My Business';

    // Get full client data
    const dr = await fetch(`${AGENCY_API}/clients/${client.id}`, { credentials: 'include' });
    const dd = await dr.json();
    if (dd.ok) {
      clientData = dd;
    }
  } catch (e) {
    console.error('Failed to load client data:', e);
  }
}

function logout() {
  fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  localStorage.removeItem('sof_token');
  localStorage.removeItem('sof_user');
  window.location.href = '/login.html';
}

// ---- Tab switching ----
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  setTimeout(() => renderCharts(tab), 50);
}

// ---- Render all ----
function renderAll() {
  renderLeads();
  renderMarketing();
  renderGoals();
  renderSchedule();
  renderReports();
}

// ---- Helper: get automations for a group ----
function getGroupAutomations(group) {
  if (!clientData?.automations) return [];
  const types = AUTOMATION_GROUPS[group].types;
  return clientData.automations.filter(a => types.includes(a.type));
}

// ---- Helper: render automation list ----
function renderAutoList(containerId, group) {
  const el = document.getElementById(containerId);
  const autos = getGroupAutomations(group);
  if (autos.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-4);font-size:13px">No automations active in this category yet.</div>';
    return;
  }
  const icons = { missed_call: '📞', lead_welcome: '👋', quote_followup: '💬', estimate_followup: '📋', nurture_sequence: '🔄', faq_responder: '❓', social_post: '📱', gbp_update: '📍', seasonal_campaign: '🎉', newsletter: '📰', multi_channel: '📡', content_calendar: '🗓', ad_copy: '✍', promo_offer: '🏷', review_request: '⭐', review_response: '💬', referral_request: '🤝', thank_you: '🙏', re_engagement: '🔄', winback: '↩', birthday: '🎂', upsell: '💡', appt_reminder: '📅', no_show: '❌', call_script: '📝', voicemail_followup: '📞', call_reminder: '⏰', call_summary: '📊', weekly_report: '📈', missed_revenue: '⚠' };
  el.innerHTML = autos.map(a => `
    <div class="list-row">
      <div class="lr-icon" style="background:var(--accent-bg)">${icons[a.type] || '⚙'}</div>
      <div class="lr-body">
        <div class="lr-title">${esc(a.name || a.type)}</div>
        <div class="lr-sub">${esc(a.channel || 'sms')} · ${esc(a.type)}</div>
      </div>
      <span class="lr-tag ${a.status === 'active' ? 'tag-active' : a.status === 'draft' ? 'tag-draft' : 'tag-pending'}">${a.status || 'active'}</span>
    </div>
  `).join('');
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---- Render each tab's data ----
function renderLeads() {
  const contacts = clientData?.contacts || [];
  const leads = contacts.filter(c => (c.tags || []).includes('lead'));
  const customers = contacts.filter(c => (c.tags || []).includes('customer'));
  document.getElementById('statLeadsTotal').textContent = contacts.length;
  document.getElementById('statLeadsConverted').textContent = customers.length;
  document.getElementById('statLeadsResponse').textContent = '42s';
  document.getElementById('statLeadsRecovered').textContent = '$' + (contacts.length * 340).toLocaleString();
  renderAutoList('leadsAutomations', 'leads');
}

function renderMarketing() {
  const autos = getGroupAutomations('marketing');
  document.getElementById('statMktCampaigns').textContent = autos.filter(a => a.status === 'active').length;
  document.getElementById('statMktReach').textContent = '12.4K';
  document.getElementById('statMktEngagement').textContent = '8.7%';
  document.getElementById('statMktPosts').textContent = autos.length * 3;
  renderAutoList('mktAutomations', 'marketing');
}

function renderGoals() {
  document.getElementById('statGoalReviews').textContent = '47';
  document.getElementById('statGoalReferrals').textContent = '12';
  document.getElementById('statGoalRevenue').textContent = '$48K';
  document.getElementById('statGoalRetention').textContent = '92%';
  renderAutoList('goalAutomations', 'goals');
  // Progress bars
  const goals = [
    { label: 'Google Reviews', current: 47, target: 75, color: 'var(--emerald)' },
    { label: 'Referral Rate', current: 18, target: 25, color: 'var(--accent)' },
    { label: 'Revenue (Quarter)', current: 48, target: 80, color: 'var(--amber)' },
    { label: 'Customer Retention', current: 92, target: 95, color: 'var(--cyan)' },
    { label: 'Response Time', current: 88, target: 95, color: 'var(--violet)' },
  ];
  document.getElementById('goalProgress').innerHTML = goals.map(g => {
    const pct = Math.min(100, (g.current / g.target * 100));
    return `<div class="progress-item">
      <div class="pi-head"><span class="pi-label">${g.label}</span><span class="pi-value">${g.current}/${g.target}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${g.color}"></div></div>
    </div>`;
  }).join('');
}

function renderSchedule() {
  document.getElementById('statSchedUpcoming').textContent = '8';
  document.getElementById('statSchedCompleted').textContent = '34';
  document.getElementById('statSchedNoShow').textContent = '3';
  document.getElementById('statSchedRate').textContent = '8.1%';
  renderAutoList('schedAutomations', 'schedule');
  // Upcoming reminders (mock from contacts)
  const contacts = clientData?.contacts || [];
  document.getElementById('schedUpcoming').innerHTML = contacts.slice(0, 4).map((c, i) => `
    <div class="list-row">
      <div class="lr-icon" style="background:var(--accent-bg)">📅</div>
      <div class="lr-body">
        <div class="lr-title">${esc(c.name)}</div>
        <div class="lr-sub">${['Tomorrow 9am', 'Tomorrow 2pm', 'Wed 10am', 'Thu 3pm'][i] || 'TBD'} · ${esc(c.phone || '')}</div>
      </div>
      <span class="lr-tag tag-active">Confirmed</span>
    </div>
  `).join('') || '<div style="text-align:center;padding:20px;color:var(--text-4)">No upcoming appointments.</div>';
}

function renderReports() {
  document.getElementById('statRepRevenue').textContent = '$48.2K';
  document.getElementById('statRepCaptured').textContent = '$31.4K';
  document.getElementById('statRepRecovered').textContent = '$16.8K';
  document.getElementById('statRepAutomations').textContent = '247';
  // Recent activity
  const contacts = clientData?.contacts || [];
  const activities = [
    `Missed call text-back sent to ${contacts[0]?.name || 'John M.'}`,
    `Review request sent to ${contacts[1]?.name || 'Sarah C.'}`,
    `Appointment reminder sent to ${contacts[2]?.name || 'Mike T.'}`,
    `Quote follow-up sent to ${contacts[0]?.name || 'David W.'}`,
    `Weekly report generated`,
  ];
  document.getElementById('repActivity').innerHTML = activities.map((a, i) => `
    <div class="list-row">
      <div class="lr-icon" style="background:${['var(--emerald-bg)','var(--accent-bg)','var(--cyan-bg)','var(--amber-bg)','var(--violet-bg)'][i]}">${['✓','⭐','📅','💬','📊'][i]}</div>
      <div class="lr-body">
        <div class="lr-title">${a}</div>
        <div class="lr-sub">${['2h ago','5h ago','1d ago','2d ago','3d ago'][i]}</div>
      </div>
    </div>
  `).join('');
}
