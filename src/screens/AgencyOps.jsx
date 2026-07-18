import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Phone, MessageSquare, Calendar, Database, Bell,
  BarChart3, Users, Workflow, Play, CheckCircle2, AlertCircle,
  RefreshCw, Zap, Mail, Star, Repeat, ShieldCheck, Loader2,
  Plus, Trash2, Send, Edit3, Sparkles, ChevronRight, X,
} from 'lucide-react';

const API = 'http://localhost:8787/api/agency';

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, both: Send, none: Sparkles };
const CHANNEL_COLOR = { sms: 'text-sky-400', email: 'text-violet-400', both: 'text-amber-400', none: 'text-pink-400' };

// Category grouping for the catalog (so 22 automations are scannable, not a flat list)
const CATALOG_CATEGORY = {
  // Core comms
  missed_call: 'Lead Capture', lead_welcome: 'Lead Capture', appt_reminder: 'Appointments', no_show: 'Appointments',
  quote_followup: 'Sales Pipeline', estimate_followup: 'Sales Pipeline', nurture_sequence: 'Sales Pipeline', upsell: 'Sales Pipeline',
  // Reputation + Marketing
  review_request: 'Reputation', review_response: 'Reputation', referral_request: 'Reputation', thank_you: 'Reputation',
  social_post: 'Marketing', gbp_update: 'Marketing', seasonal_campaign: 'Marketing', newsletter: 'Marketing',
  // Retention
  re_engagement: 'Retention', winback: 'Retention', birthday: 'Retention',
  // Reporting
  weekly_report: 'Reporting', missed_revenue: 'Reporting', faq_responder: 'Customer Service',
};
const CATEGORY_ORDER = ['Lead Capture', 'Appointments', 'Sales Pipeline', 'Reputation', 'Marketing', 'Retention', 'Customer Service', 'Reporting'];

function fmtTime(iso) { return iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }

export default function AgencyOps() {
  const [clients, setClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [drafting, setDrafting] = useState({}); // {contactId: true} while drafting
  const [research, setResearch] = useState([]);
  const [analysis, setAnalysis] = useState({ intake: null, analyses: [], goals: [] });
  const [testLab, setTestLab] = useState({ open: false, type: null, context: '', result: null, loading: false });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/clients`);
      const j = await r.json();
      setClients(j.clients || []);
      if (!activeClient && j.clients?.length) setActiveClient(j.clients[0].id);
    } catch (e) { showToast('Fetch failed: ' + e.message); }
    finally { setLoading(false); }
  }, [activeClient]);

  const fetchCatalog = useCallback(async () => {
    try { const r = await fetch(`${API}/catalog`); const j = await r.json(); setCatalog(j.catalog || {}); } catch {}
  }, []);

  const fetchClientData = useCallback(async () => {
    if (!activeClient) return;
    try {
      const r = await fetch(`${API}/clients/${activeClient}`);
      const j = await r.json();
      setClientData(j.ok ? j : null);
    } catch (e) { showToast('Load failed: ' + e.message); }
  }, [activeClient]);

  useEffect(() => { fetchClients(); fetchCatalog(); }, []);
  useEffect(() => { fetchClientData(); }, [activeClient, fetchClientData]);
  useEffect(() => { if (activeClient) { fetchResearch(); fetchAnalysis(); } }, [activeClient]);

  async function fetchResearch() {
    if (!activeClient) return;
    try { const r = await fetch(`${API}/clients/${activeClient}/research`); const j = await r.json(); setResearch(j.research || []); } catch {}
  }
  async function fetchAnalysis() {
    if (!activeClient) return;
    try { const r = await fetch(`${API}/clients/${activeClient}/analysis`); const j = await r.json(); setAnalysis(j.analysis || { intake: null, analyses: [], goals: [] }); } catch {}
  }

  function showToast(msg, type = 'info') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  // ---- Actions ----
  const addClient = async (profile) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }) });
      const j = await r.json();
      if (j.ok) { showToast(`Client "${profile.name}" created`); setShowAddClient(false); fetchClients(); setActiveClient(j.id); }
      else showToast('Create failed: ' + (j.error || ''), 'error');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const addContact = async (contact) => {
    const r = await fetch(`${API}/clients/${activeClient}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) });
    const j = await r.json();
    if (j.ok) { showToast(`Contact "${contact.name}" added`); fetchClientData(); }
  };

  const addAutomation = async (auto) => {
    const r = await fetch(`${API}/clients/${activeClient}/automations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(auto) });
    const j = await r.json();
    if (j.ok) { showToast(`Automation "${auto.name}" created`); fetchClientData(); }
  };

  const draftMsg = async (contactId, automationType, context) => {
    setDrafting(d => ({ ...d, [contactId]: true }));
    try {
      const r = await fetch(`${API}/clients/${activeClient}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, automationType, context }) });
      const j = await r.json();
      if (j.ok) { showToast('Draft generated — review & approve to send'); fetchClientData(); }
      else showToast('Draft failed: ' + (j.error || ''), 'error');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    finally { setDrafting(d => ({ ...d, [contactId]: false })); }
  };

  const sendMsg = async (messageId) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }) });
      const j = await r.json();
      if (j.ok) { showToast(j.sendResult?.simulated ? 'Sent (SIMULATED — no provider configured)' : 'Sent!'); fetchClientData(); }
      else showToast('Send failed: ' + (j.error || ''), 'error');
    } finally { setBusy(false); }
  };

  const runAutomation = async (automationId) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/run-automation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automationId }) });
      const j = await r.json();
      if (j.ok) { showToast(`Generated ${j.draftsGenerated} draft(s) — review in Messages`); fetchClientData(); }
    } finally { setBusy(false); }
  };

  // ---- Test Lab: instantly draft any automation with sample data, no contact needed ----
  const runTestLab = async (type, context) => {
    setTestLab(t => ({ ...t, loading: true, result: null }));
    try {
      // Create a temp test contact if none exists, or use the first contact
      let contactId;
      if (contacts.length > 0) { contactId = contacts[0].id; }
      else {
        const r = await fetch(`${API}/clients/${activeClient}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Customer', phone: '+15555555555', email: 'test@example.com', tags: ['test'], notes: 'Test Lab contact' }) });
        const j = await r.json(); contactId = j.contact?.id; fetchClientData();
      }
      const r2 = await fetch(`${API}/clients/${activeClient}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, automationType: type, context: context ? JSON.parse(context) : {} }) });
      const j2 = await r2.json();
      if (j2.ok) { setTestLab(t => ({ ...t, result: j2.message, loading: false })); showToast('Draft generated — review below'); }
      else { showToast('Test failed: ' + (j2.error || ''), 'error'); setTestLab(t => ({ ...t, loading: false })); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); setTestLab(t => ({ ...t, loading: false })); }
  };

  // ---- Research ----
  const runResearch = async (prompt) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const j = await r.json();
      if (j.ok) { showToast('Research complete'); fetchResearch(); }
      else showToast('Research failed: ' + (j.error || ''), 'error');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  // ---- Analysis ----
  const saveIntake = async (intake) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/intake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(intake) });
      const j = await r.json();
      if (j.ok) { showToast('Business data saved'); fetchAnalysis(); }
    } finally { setBusy(false); }
  };
  const runAnalysis = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const j = await r.json();
      if (j.ok) { showToast('Analysis complete — see goals below'); fetchAnalysis(); }
      else showToast('Analysis failed: ' + (j.error || ''), 'error');
    } finally { setBusy(false); }
  };
  const runProgressLoop = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/clients/${activeClient}/progress-loop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const j = await r.json();
      if (j.ok) { showToast('Progress updated'); fetchAnalysis(); }
      else showToast('Loop failed: ' + (j.error || ''), 'error');
    } finally { setBusy(false); }
  };

  const deleteClient = async (id, name) => {
    if (!confirm(`Delete "${name}" and ALL its data? This cannot be undone.`)) return;
    const r = await fetch(`${API}/clients/${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (j.ok) { showToast(`Deleted "${name}"`); setActiveClient(null); fetchClients(); }
  };

  const profile = clientData?.profile;
  const contacts = clientData?.contacts || [];
  const automations = clientData?.automations || [];
  const templates = clientData?.templates || [];
  const messages = clientData?.messages || [];

  return (
    <div className="min-h-screen pb-12">
      {/* header */}
      <div className="px-6 lg:px-8 pt-6 pb-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/20 to-amber-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-gold-400" /></div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white/90">AI Agency Ops</h1>
          <p className="text-[11px] text-white/40">Multi-client SMS + Email automation — unlimited businesses</p>
        </div>
        <button onClick={() => setShowAddClient(true)} className="glow-gold flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/15 text-gold-400 hover:bg-gold-500/25 border border-gold-500/20 text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> Add Client
        </button>
        <a href="/agency.html" target="_blank" rel="noopener" className="glow-sky flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/20 text-sm font-medium transition-all" title="Open the full bright-white Agency platform in a new tab">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open Full Agency
        </a>
        <button onClick={fetchClients} className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 p-4 lg:p-7">
        {/* Client sidebar */}
        <ClientSidebar clients={clients} active={activeClient} onSelect={setActiveClient} onDelete={deleteClient} />
        {/* Main panel */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/20">
          {!profile ? (
            <div className="p-16 text-center text-white/30 text-sm">{loading ? <Loader2 className="w-7 h-7 animate-spin mx-auto text-gold-400" /> : 'Select or create a client to begin'}</div>
          ) : (
            <>
              <ClientHeader profile={profile} />
              <Tabs tab={tab} setTab={setTab} counts={{ contacts: contacts.length, automations: automations.length, messages: messages.length }} />
              <div className="p-6 lg:p-7">
                <AnimatePresence mode="wait">
                  {tab === 'dashboard' && <DashboardTab profile={profile} contacts={contacts} automations={automations} messages={messages} catalog={catalog} />}
                  {tab === 'testlab' && <TestLabTab catalog={catalog} onRun={runTestLab} testLab={testLab} setTestLab={setTestLab} />}
                  {tab === 'contacts' && <ContactsTab contacts={contacts} catalog={catalog} onAdd={addContact} onDraft={draftMsg} drafting={drafting} />}
                  {tab === 'automations' && <AutomationsTab automations={automations} catalog={catalog} onAdd={addAutomation} onRun={runAutomation} busy={busy} />}
                  {tab === 'messages' && <MessagesTab messages={messages} contacts={contacts} onSend={sendMsg} busy={busy} />}
                  {tab === 'research' && <ResearchTab research={research} onRun={runResearch} busy={busy} />}
                  {tab === 'analysis' && <AnalysisTab analysis={analysis} onSaveIntake={saveIntake} onAnalyze={runAnalysis} onProgressLoop={runProgressLoop} busy={busy} />}
                  {tab === 'settings' && <SettingsTab profile={profile} onSaved={() => fetchClientData()} clientId={activeClient} />}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>{showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onCreate={addClient} busy={busy} />}</AnimatePresence>
      <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>
    </div>
  );
}

// ---- Client sidebar ----
function ClientSidebar({ clients, active, onSelect, onDelete }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 max-h-[78vh] overflow-y-auto scrollable sticky top-4">
      <div className="flex items-center gap-2 px-2 py-2.5 mb-2 border-b border-white/[0.05]"><Users className="w-4 h-4 text-gold-400/70" /><p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Clients ({clients.length})</p></div>
      {clients.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-xs">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No clients yet.<br />Click "Add Client" to create one.
        </div>
      ) : clients.map((c) => (
        <div key={c.id} onClick={() => onSelect(c.id)} className={`group flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-1.5 ${active === c.id ? 'bg-gold-500/10 border border-gold-500/25 shadow-lg shadow-gold-500/5' : 'hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08]'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${active === c.id ? 'bg-gold-500/20 text-gold-300' : 'bg-white/5 text-white/40'}`}>{c.name?.slice(0,2).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate font-medium transition-colors ${active === c.id ? 'text-white/95' : 'text-white/65'}`}>{c.name}</p>
            <p className="text-[10px] text-white/35 capitalize">{c.industry}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(c.id, c.name); }} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-rose-400 transition-all p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ---- Client header ----
function ClientHeader({ profile }) {
  return (
    <div className="p-5 lg:p-6 border-b border-white/[0.06] flex items-center gap-4 bg-gradient-to-r from-white/[0.03] to-transparent">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg" style={{ background: `linear-gradient(135deg, ${profile.branding?.primaryColor || '#3b82f6'}40, ${profile.branding?.primaryColor || '#3b82f6'}15)`, color: profile.branding?.primaryColor || '#3b82f6', border: `1px solid ${profile.branding?.primaryColor || '#3b82f6'}30` }}>
        {profile.name?.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-white/95">{profile.name}</h2>
        <p className="text-xs text-white/45 capitalize">{profile.industry} · {profile.branding?.tone || 'friendly'} tone · {profile.phone || 'no phone'}</p>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${profile.smsProvider?.sid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/40 border border-white/5'}`}><MessageSquare className="w-3 h-3" /> SMS {profile.smsProvider?.sid ? '✓' : 'sim'}</span>
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${profile.emailProvider?.host ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/40 border border-white/5'}`}><Mail className="w-3 h-3" /> Email {profile.emailProvider?.host ? '✓' : 'sim'}</span>
      </div>
    </div>
  );
}

// ---- Tabs ----
function Tabs({ tab, setTab, counts }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'testlab', label: 'Test Lab', icon: Zap },
    { id: 'contacts', label: 'Contacts', icon: Users, count: counts.contacts },
    { id: 'automations', label: 'Automations', icon: Workflow, count: counts.automations },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: counts.messages },
    { id: 'research', label: 'Research', icon: ShieldCheck },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: ShieldCheck },
  ];
  return (
    <div className="flex items-center gap-1 px-4 border-b border-white/[0.06] overflow-x-auto scrollable bg-white/[0.01]">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)} className={`group relative flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'tab-active border-gold-400 text-gold-400' : 'border-transparent text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
          <t.icon className={`w-4 h-4 transition-transform ${tab === t.id ? 'scale-110' : 'group-hover:scale-105'}`} /> {t.label}
          {t.count != null && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${tab === t.id ? 'bg-gold-500/20 text-gold-300' : 'bg-white/10 text-white/50'}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- Toast ----
function Toast({ msg, type }) {
  const color = type === 'error' ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  const Icon = type === 'error' ? AlertCircle : CheckCircle2;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border ${color} backdrop-blur-md`}>
      <Icon className="w-4 h-4" /> <span className="text-sm">{msg}</span>
    </motion.div>
  );
}

// ---- Dashboard tab ----
function DashboardTab({ profile, contacts, automations, messages, catalog }) {
  const drafts = messages.filter(m => m.status === 'draft');
  const sent = messages.filter(m => m.status === 'sent');
  const tags = [...new Set(contacts.flatMap(c => c.tags || []))];
  const stats = [
    { label: 'Contacts', value: contacts.length, icon: Users, color: 'text-sky-400' },
    { label: 'Automations', value: automations.length, icon: Workflow, color: 'text-violet-400' },
    { label: 'Drafts Pending', value: drafts.length, icon: Edit3, color: 'text-amber-400' },
    { label: 'Messages Sent', value: sent.length, icon: Send, color: 'text-emerald-400' },
  ];
  return (
    <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <div className={`w-2 h-2 rounded-full ${s.color.replace('text-', 'bg-')} opacity-60`} />
            </div>
            <p className="text-3xl font-bold text-white/95">{s.value}</p>
            <p className="text-xs text-white/45 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <p className="text-sm font-semibold text-white/70 mb-3">Contact Tags</p>
          {tags.length ? <div className="flex flex-wrap gap-2">{tags.map(t => <span key={t} className="px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">{t} ({contacts.filter(c => c.tags?.includes(t)).length})</span>)}</div> : <p className="text-sm text-white/30">No tags yet</p>}
        </div>
        <div className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <p className="text-sm font-semibold text-white/70 mb-3">Available Automation Types ({Object.keys(catalog).length})</p>
          <div className="flex flex-wrap gap-2">{Object.entries(catalog).map(([k, v]) => { const Ic = CHANNEL_ICON[v.channel] || Zap; return <span key={k} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/[0.06] text-[11px] font-medium ${CHANNEL_COLOR[v.channel]}`}><Ic className="w-3 h-3" />{v.name}</span>; })}</div>
        </div>
      </div>
      {drafts.length > 0 && (
        <div className="mt-5 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center"><Edit3 className="w-5 h-5 text-amber-400" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">{drafts.length} draft(s) awaiting approval</p>
            <p className="text-xs text-white/40">Go to the Messages tab to review & approve.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---- Contacts tab ----
function ContactsTab({ contacts, catalog, onAdd, onDraft, drafting }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draftPick, setDraftPick] = useState(null); // contact being drafted
  return (
    <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-medium text-white/60">{contacts.length} contacts</p>
        <button onClick={() => setShowAdd(true)} className="glow-sky flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/20 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> Add Contact</button>
      </div>
      {contacts.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No contacts yet.<br />Add one to start automating.
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <div key={c.id} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500/20 to-sky-500/5 border border-sky-500/20 flex items-center justify-center text-sm font-bold text-sky-300">{c.name?.slice(0,1).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90">{c.name}</p>
                <div className="flex items-center gap-3 text-xs text-white/45 mt-0.5">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                  <span className="text-white/30">·</span><span className="capitalize">{c.status}</span>
                </div>
                {c.tags?.length > 0 && <div className="flex gap-1.5 mt-1.5">{c.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.06] text-[10px] text-white/50">{t}</span>)}</div>}
              </div>
              <button onClick={() => setDraftPick(c)} disabled={drafting[c.id]} className="glow-violet flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20 text-xs font-medium transition-all disabled:opacity-50">
                {drafting[c.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Draft
              </button>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>{showAdd && <AddContactModal onClose={() => setShowAdd(false)} onAdd={(c) => { onAdd(c); setShowAdd(false); }} />}</AnimatePresence>
      <AnimatePresence>{draftPick && <DraftPickerModal contact={draftPick} catalog={catalog} onClose={() => setDraftPick(null)} onDraft={(type, ctx) => { onDraft(draftPick.id, type, ctx); setDraftPick(null); }} />}</AnimatePresence>
    </motion.div>
  );
}

// ---- Automations tab ----
function AutomationsTab({ automations, catalog, onAdd, onRun, busy }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <motion.div key="autos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-medium text-white/60">{automations.length} automations</p>
        <button onClick={() => setShowAdd(true)} className="glow-violet flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> New Automation</button>
      </div>
      {automations.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <Workflow className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No automations yet.<br />Create one to batch-generate messages for matching contacts.
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => {
            const cat = catalog[a.type] || {};
            const Ic = CHANNEL_ICON[cat.channel || a.channel] || Zap;
            return (
              <div key={a.id} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center ${CHANNEL_COLOR[cat.channel] || 'text-white/40'}`}><Ic className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">{a.name}</p>
                    <p className="text-xs text-white/45 mt-0.5">{cat.name || a.type} · {a.tags?.length ? `tags: ${a.tags.join(', ')}` : 'all contacts'} · runs: {a.runs || 0}</p>
                  </div>
                  <button onClick={() => onRun(a.id)} disabled={busy} className="glow-emerald flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-xs font-medium transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AnimatePresence>{showAdd && <AddAutomationModal catalog={catalog} onClose={() => setShowAdd(false)} onAdd={(a) => { onAdd(a); setShowAdd(false); }} />}</AnimatePresence>
    </motion.div>
  );
}

// ---- Messages tab ----
function MessagesTab({ messages, contacts, onSend, busy }) {
  const contactName = (id) => contacts.find(c => c.id === id)?.name || 'Unknown';
  const sorted = [...messages].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return (
    <motion.div key="msgs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <p className="text-sm font-medium text-white/60 mb-5">{messages.length} messages</p>
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No messages yet.<br />Draft one from the Contacts tab or run an Automation.
        </div>
      ) : (
        <div className="space-y-3 max-h-[65vh] overflow-y-auto scrollable pr-1">
          {sorted.map((m) => {
            const Ic = m.channel === 'email' ? Mail : MessageSquare;
            const statusColor = m.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : m.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            return (
              <div key={m.id} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${CHANNEL_COLOR[m.channel] || 'text-white/40'}`}><Ic className="w-4 h-4" /></div>
                  <span className="text-sm font-medium text-white/90">{contactName(m.contactId)}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>{m.status}</span>
                  <span className="text-[10px] text-white/30 ml-auto">{fmtTime(m.timestamp)}</span>
                </div>
                <p className="text-xs text-white/70 whitespace-pre-wrap bg-black/30 border border-white/[0.04] rounded-lg p-3 mb-3 max-h-40 overflow-y-auto scrollable leading-relaxed">{m.body}</p>
                {m.status === 'draft' && (
                  <button onClick={() => onSend(m.id)} disabled={busy} className="glow-emerald flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-xs font-medium transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Approve & Send
                  </button>
                )}
                {m.sendResult?.simulated && <p className="text-[10px] text-amber-400/60 italic mt-2">⚠ Simulated — no provider configured (see Settings)</p>}
                {m.sendResult?.error && <p className="text-[10px] text-rose-400/60 mt-2">Error: {m.sendResult.error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ---- Settings tab ----
function SettingsTab({ profile, clientId, onSaved }) {
  const [sp, setSp] = useState(profile.smsProvider || {});
  const [ep, setEp] = useState(profile.emailProvider || {});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await fetch(`http://localhost:8787/api/agency/clients/${clientId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ smsProvider: sp, emailProvider: ep }) });
    setSaving(false); onSaved();
  };
  return (
    <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <p className="text-sm text-white/60 mb-5">Provider Settings — connect to send real SMS/Email. Leave blank for simulation mode.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-sky-400" /></div><p className="text-sm font-semibold text-white/80">SMS (Twilio)</p></div>
          <div className="space-y-3">
            <input value={sp.sid || ''} onChange={e => setSp({...sp, sid: e.target.value})} placeholder="Account SID" className="modal-input" />
            <input value={sp.token || ''} onChange={e => setSp({...sp, token: e.target.value})} placeholder="Auth Token" type="password" className="modal-input" />
            <input value={sp.fromNumber || ''} onChange={e => setSp({...sp, fromNumber: e.target.value})} placeholder="From Number (+1...)" className="modal-input" />
          </div>
        </div>
        <div className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center"><Mail className="w-4 h-4 text-violet-400" /></div><p className="text-sm font-semibold text-white/80">Email (SMTP)</p></div>
          <div className="space-y-3">
            <input value={ep.host || ''} onChange={e => setEp({...ep, host: e.target.value})} placeholder="SMTP Host (smtp.gmail.com)" className="modal-input" />
            <input value={ep.port || ''} onChange={e => setEp({...ep, port: e.target.value})} placeholder="Port (587)" className="modal-input" />
            <input value={ep.user || ''} onChange={e => setEp({...ep, user: e.target.value})} placeholder="Username" className="modal-input" />
            <input value={ep.pass || ''} onChange={e => setEp({...ep, pass: e.target.value})} placeholder="Password / App Password" type="password" className="modal-input" />
            <input value={ep.from || ''} onChange={e => setEp({...ep, from: e.target.value})} placeholder="From Email" className="modal-input" />
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="glow-gold mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-400 hover:bg-gold-500/25 border border-gold-500/20 text-sm font-medium transition-all disabled:opacity-40">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Save Providers
      </button>
    </motion.div>
  );
}

// ---- Add Client modal ----
function AddClientModal({ onClose, onCreate, busy }) {
  const [name, setName] = useState(''); const [industry, setIndustry] = useState('hvac');
  const [phone, setPhone] = useState(''); const [tone, setTone] = useState('friendly');
  const industries = ['hvac','roofing','plumbing','dental','legal','real-estate','fitness','restaurant','auto','salon','general'];
  return (
    <ModalShell onClose={onClose} title="Add Client Business">
      <div className="space-y-3">
        <Field label="Business Name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Acme HVAC" className="modal-input" /></Field>
        <Field label="Industry"><select value={industry} onChange={e=>setIndustry(e.target.value)} className="modal-input">{industries.map(i=><option key={i} value={i}>{i}</option>)}</select></Field>
        <Field label="Business Phone"><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="5551234567" className="modal-input" /></Field>
        <Field label="Brand Tone"><select value={tone} onChange={e=>setTone(e.target.value)} className="modal-input"><option>friendly</option><option>professional</option><option>casual</option><option>formal</option></select></Field>
        <button onClick={() => onCreate({ name, industry, phone, branding: { tone } })} disabled={busy || !name} className="modal-btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Client</button>
      </div>
    </ModalShell>
  );
}

// ---- Add Contact modal ----
function AddContactModal({ onClose, onAdd }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [tags, setTags] = useState('');
  return (
    <ModalShell onClose={onClose} title="Add Contact">
      <div className="space-y-3">
        <Field label="Name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith" className="modal-input" /></Field>
        <Field label="Phone"><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="5550000" className="modal-input" /></Field>
        <Field label="Email"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="john@email.com" className="modal-input" /></Field>
        <Field label="Tags (comma-separated)"><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="lead, customer, emergency" className="modal-input" /></Field>
        <button onClick={() => onAdd({ name, phone, email, tags: tags.split(',').map(t=>t.trim()).filter(Boolean), status: 'new' })} disabled={!name} className="modal-btn-primary"><Plus className="w-4 h-4" /> Add Contact</button>
      </div>
    </ModalShell>
  );
}

// ---- Draft Picker modal (choose automation type for a contact) ----
function DraftPickerModal({ contact, catalog, onClose, onDraft }) {
  const [picked, setPicked] = useState(null);
  return (
    <ModalShell onClose={onClose} title={`Draft message for ${contact.name}`}>
      <p className="text-xs text-white/40 mb-3">Pick an automation type. AI will draft a personalized message (you'll approve before sending).</p>
      <div className="space-y-3 max-h-72 overflow-y-auto">
        {CATEGORY_ORDER.map(cat => {
          const items = Object.entries(catalog).filter(([k]) => CATALOG_CATEGORY[k] === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5">{cat}</p>
              <div className="space-y-1.5">
                {items.map(([k, v]) => {
                  const Ic = CHANNEL_ICON[v.channel] || Zap;
                  return (
                    <button key={k} onClick={() => setPicked(k)} className={`w-full flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${picked === k ? 'bg-violet-500/10 border-violet-500/25' : 'bg-white/[0.02] border-white/05 hover:bg-white/[0.04]'}`}>
                      <Ic className={`w-4 h-4 mt-0.5 flex-shrink-0 ${CHANNEL_COLOR[v.channel]}`} />
                      <div><p className="text-xs text-white/80">{v.name}</p><p className="text-[10px] text-white/40">{v.desc}</p></div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => onDraft(picked, {})} disabled={!picked} className="modal-btn-primary mt-3"><Sparkles className="w-4 h-4" /> Generate Draft</button>
    </ModalShell>
  );
}

// ---- Add Automation modal ----
function AddAutomationModal({ catalog, onClose, onAdd }) {
  const [name, setName] = useState(''); const [type, setType] = useState('missed_call'); const [tags, setTags] = useState('');
  const cat = catalog[type] || {};
  return (
    <ModalShell onClose={onClose} title="New Automation">
      <div className="space-y-3">
        <Field label="Automation Name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Post-Job Review Request" className="modal-input" /></Field>
        <Field label="Type"><select value={type} onChange={e=>{setType(e.target.value); setName(catalog[e.target.value]?.name || name);}} className="modal-input">{Object.entries(catalog).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}</select></Field>
        <p className="text-[11px] text-white/40 bg-white/[0.02] rounded-lg p-2">{cat.desc}</p>
        <Field label="Target Tags (comma-separated, blank = all)"><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="customer" className="modal-input" /></Field>
        <button onClick={() => onAdd({ name: name || cat.name, type, channel: cat.channel, tags: tags.split(',').map(t=>t.trim()).filter(Boolean) })} className="modal-btn-primary"><Plus className="w-4 h-4" /> Create Automation</button>
      </div>
    </ModalShell>
  );
}

// ---- Shared modal bits ----
function ModalShell({ children, title, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e=>e.stopPropagation()} className="bg-[#15151a] border border-white/10 rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold text-white/90">{title}</h3><button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button></div>
        {children}
      </motion.div>
    </motion.div>
  );
}
function Field({ label, children }) { return <div><label className="text-[11px] text-white/40 mb-1 block">{label}</label>{children}</div>; }

// ---- Test Lab tab — instantly test ANY automation with sample data ----
function TestLabTab({ catalog, onRun, testLab, setTestLab }) {
  const [type, setType] = useState('missed_call');
  const [context, setContext] = useState('');
  const cat = catalog[type] || {};
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/[0.03] border border-violet-500/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center"><Zap className="w-5 h-5 text-violet-400" /></div>
          <div>
            <h3 className="text-base font-semibold text-white/90">Automation Test Lab</h3>
            <p className="text-xs text-white/45">Instantly preview any automation — no contact needed, uses a test customer.</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">
        <Field label="Automation Type">
          <select value={type} onChange={e => setType(e.target.value)} className="modal-input">
            {CATEGORY_ORDER.map(c => {
              const items = Object.entries(catalog).filter(([k]) => CATALOG_CATEGORY[k] === c);
              if (!items.length) return null;
              return <optgroup key={c} label={c}>{items.map(([k, v]) => <option key={k} value={k}>{v.name} ({v.channel})</option>)}</optgroup>;
            })}
          </select>
        </Field>
        {cat.desc && (
          <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/5 ${CHANNEL_COLOR[cat.channel]}`}>{cat.channel}</span>
              <span className="text-[10px] text-white/40">{cat.trigger}</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{cat.desc}</p>
          </div>
        )}
        <Field label="Context (optional JSON — e.g. {&quot;offer&quot;: &quot;$25 off&quot;})">
          <input value={context} onChange={e => setContext(e.target.value)} placeholder='{}' className="modal-input font-mono" />
        </Field>
        <button onClick={() => onRun(type, context)} disabled={testLab.loading} className="glow-violet modal-btn-primary !bg-violet-500/15 !text-violet-400 hover:!bg-violet-500/25 !border-violet-500/20">
          {testLab.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate Test Draft
        </button>
      </div>
      {testLab.result && (
        <div className="rounded-2xl bg-white/[0.04] border border-violet-500/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white/80">AI Draft Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/5 ${CHANNEL_COLOR[testLab.result.channel] || 'text-white/40'}`}>{testLab.result.channel}</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{testLab.result.status}</span>
            </div>
          </div>
          <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono bg-black/30 border border-white/[0.04] rounded-lg p-4 max-h-80 overflow-y-auto scrollable leading-relaxed">{testLab.result.body}</pre>
          <p className="text-[11px] text-white/35 mt-3 flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> Saved as a draft — go to the Messages tab to approve & send it.</p>
        </div>
      )}
    </div>
  );
}

// ---- Research tab — competitor research ----
function ResearchTab({ research, onRun, busy }) {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-500/[0.03] border border-sky-500/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-sky-400" /></div>
          <div>
            <h3 className="text-base font-semibold text-white/90">Competitor Research</h3>
            <p className="text-xs text-white/45">AI searches the web, ranks competitors, finds market gaps, and recommends moves.</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">
        <Field label="Research Prompt">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Find HVAC companies in Dallas TX and compare them to us" rows={3} className="modal-input resize-none" />
        </Field>
        <button onClick={() => onRun(prompt)} disabled={busy || !prompt.trim()} className="glow-sky modal-btn-primary !bg-sky-500/15 !text-sky-400 hover:!bg-sky-500/25 !border-sky-500/20">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Run Research
        </button>
      </div>
      {research.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No research yet.<br />Run your first competitor analysis above.
        </div>
      )}
      {research.map(r => (
        <div key={r.id} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
            <span className="text-sm text-white/70 font-medium">{r.prompt}</span>
            <span className="text-[11px] text-white/40">{new Date(r.date).toLocaleDateString()}</span>
          </div>
          {r.competitors?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-2">Competitors ({r.competitors.length})</p>
              <div className="space-y-2">{r.competitors.map((c, i) => (
                <div key={i} className="text-xs bg-black/20 border border-white/[0.04] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white/80 font-medium">{c.name}</p>
                    {c.rating && <span className="text-amber-400 font-semibold">{c.rating}★</span>}
                  </div>
                  <p className="text-[11px] text-emerald-400/70 mb-0.5">✓ {c.strengths}</p>
                  <p className="text-[11px] text-rose-400/70">✗ {c.weaknesses}</p>
                </div>
              ))}</div>
            </div>
          )}
          {r.marketGaps?.length > 0 && (
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Market Gaps</p><ul className="text-xs text-white/70 space-y-1">{r.marketGaps.map((g, i) => <li key={i} className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">▸</span>{g}</li>)}</ul></div>
          )}
          {r.recommendations?.length > 0 && (
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Recommended Moves</p><ul className="text-xs text-emerald-300/80 space-y-1">{r.recommendations.map((g, i) => <li key={i} className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">→</span>{g}</li>)}</ul></div>
          )}
          {r.searchResults?.length > 0 && <p className="text-[10px] text-white/30 pt-2 border-t border-white/[0.04]">{r.searchResults.length} web sources found</p>}
        </div>
      ))}
    </div>
  );
}

// ---- Analysis tab — business analyzation engine ----
function AnalysisTab({ analysis, onSaveIntake, onAnalyze, onProgressLoop, busy }) {
  const intake = analysis.intake;
  const latest = analysis.analyses?.[0];
  const goals = analysis.goals || [];
  const [form, setForm] = useState(intake || {});

  useEffect(() => { setForm(intake || {}); }, [intake]);

  if (!intake) {
    return <IntakeForm form={form} setForm={setForm} onSave={onSaveIntake} busy={busy} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.03] border border-emerald-500/20 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
          <div>
            <h3 className="text-base font-semibold text-white/90">Business Analysis</h3>
            <p className="text-xs text-white/45">Revenue: ${intake.revenue}/mo · Leads: {intake.leadVolume}/mo · Close: {intake.closeRate}% · Goal: {intake.goal12mo}</p>
          </div>
        </div>
        <button onClick={() => onSaveIntake(form)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 hover:bg-white/10 border border-white/[0.06] transition-all">Edit Intake</button>
      </div>

      {!latest && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <button onClick={onAnalyze} disabled={busy} className="glow-emerald modal-btn-primary !bg-emerald-500/15 !text-emerald-400 hover:!bg-emerald-500/25 !border-emerald-500/20">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run Full Business Analysis
          </button>
          <p className="text-xs text-white/40 mt-3 text-center">The AI will generate a SWOT, set 4-6 benchmark goals with daily/weekly/monthly action plans.</p>
        </div>
      )}

      {latest && (
        <>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-emerald-400" /><span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">AI Summary</span></div>
            <p className="text-sm text-white/75 leading-relaxed">{latest.summary}</p>
          </div>

          {latest.swot && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['strengths', 'weaknesses', 'opportunities', 'threats'].map(k => {
                const colors = { strengths: 'text-emerald-400 border-emerald-500/15', weaknesses: 'text-rose-400 border-rose-500/15', opportunities: 'text-sky-400 border-sky-500/15', threats: 'text-amber-400 border-amber-500/15' };
                return (
                  <div key={k} className={`rounded-xl bg-white/[0.02] border p-4 ${colors[k]}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${colors[k].split(' ')[0]}`}>{k}</p>
                    <ul className="text-xs text-white/65 space-y-1">{(latest.swot[k] || []).map((s, i) => <li key={i} className="flex items-start gap-1.5"><span className="opacity-50 mt-0.5">•</span>{s}</li>)}</ul>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-semibold text-white/80">Growth Goals ({goals.length})</h4>
            <button onClick={onProgressLoop} disabled={busy} className="glow-emerald flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/15 transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Run Progress Loop
            </button>
          </div>

          {goals.map(g => (
            <div key={g.id} className="agency-card rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${g.priority === 'high' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : g.priority === 'medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-white/50 border border-white/10'}`}>{g.priority}</span>
                  <span className="text-sm font-medium text-white/90">{g.title}</span>
                </div>
                <span className="text-[10px] text-white/40 px-2 py-0.5 rounded-full bg-white/5">{g.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${g.progressPct || 0}%` }} /></div>
                <span className="text-xs text-white/60 w-10 text-right font-medium">{g.progressPct || 0}%</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/50">
                <span>Current: <span className="text-white/70 font-medium">{g.current}</span></span>
                <span>→</span>
                <span>Target: <span className="text-white/70 font-medium">{g.target}</span></span>
              </div>
              {g.gap && <p className="text-[11px] text-amber-400/70 bg-amber-500/5 rounded-lg px-3 py-1.5">⚠ Gap: {g.gap}</p>}
              {g.actions && (
                <div className="grid grid-cols-3 gap-2">
                  {['daily', 'weekly', 'monthly'].map(freq => (
                    <div key={freq} className="bg-black/20 border border-white/[0.04] rounded-lg p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">{freq}</p>
                      <ul className="text-[10px] text-white/55 space-y-1 leading-snug">{(g.actions[freq] || []).map((a, i) => <li key={i} className="flex items-start gap-1"><span className="opacity-40 mt-0.5">•</span>{a}</li>)}</ul>
                    </div>
                  ))}
                </div>
              )}
              {g.status && <p className={`text-[11px] flex items-center gap-1.5 ${g.status === 'stagnant' ? 'text-red-400' : g.status === 'declining' ? 'text-red-500' : 'text-emerald-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${g.status === 'stagnant' ? 'bg-red-400' : g.status === 'declining' ? 'bg-red-500' : 'bg-emerald-400'}`} /> {g.status}{g.lastNote ? ' — ' + g.lastNote : ''}</p>}
            </div>
          ))}

          <button onClick={onAnalyze} disabled={busy} className="glow-emerald modal-btn-primary !bg-emerald-500/15 !text-emerald-400 hover:!bg-emerald-500/25 !border-emerald-500/20">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-run Full Analysis
          </button>
        </>
      )}
    </div>
  );
}

// ---- Intake form (13 questions) ----
function IntakeForm({ form, setForm, onSave, busy }) {
  const Q = [
    { id: 'revenue', label: 'Monthly Revenue ($)', placeholder: '45000' },
    { id: 'costs', label: 'Monthly Costs ($)', placeholder: '30000' },
    { id: 'employees', label: 'Number of Employees', placeholder: '5' },
    { id: 'hours', label: 'Hours of Operation', placeholder: 'Mon-Fri 8am-6pm' },
    { id: 'niche', label: 'Business Niche / Services', placeholder: 'HVAC repair, installation' },
    { id: 'leadVolume', label: 'Monthly Leads', placeholder: '80' },
    { id: 'closeRate', label: 'Close Rate (%)', placeholder: '35' },
    { id: 'avgJob', label: 'Average Job Value ($)', placeholder: '650' },
    { id: 'reviews', label: 'Google Reviews (count + rating)', placeholder: '47 reviews, 4.2 stars' },
    { id: 'seasonality', label: 'Seasonality / Busy Months', placeholder: 'Summer peak, winter slow' },
    { id: 'topChannel', label: 'Top Lead Source', placeholder: 'Google, word of mouth' },
    { id: 'biggestChallenge', label: 'Biggest Challenge', placeholder: 'Slow in winter' },
    { id: 'goal12mo', label: '12-Month Goal', placeholder: 'Double revenue' },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.03] border border-emerald-500/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
          <div>
            <h3 className="text-base font-semibold text-white/90">Business Intake Questionnaire</h3>
            <p className="text-xs text-white/45">The AI needs this data to do a complete analysis. The more accurate, the better the goals.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Q.map(q => (
          <Field key={q.id} label={q.label}>
            <input value={form[q.id] || ''} onChange={e => setForm({ ...form, [q.id]: e.target.value })} placeholder={q.placeholder} className="modal-input" />
          </Field>
        ))}
      </div>
      <button onClick={() => onSave(form)} disabled={busy} className="glow-emerald modal-btn-primary !bg-emerald-500/15 !text-emerald-400 hover:!bg-emerald-500/25 !border-emerald-500/20">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Business Data
      </button>
    </div>
  );
}
