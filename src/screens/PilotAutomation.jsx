import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, RefreshCw, Loader2, AlertCircle, Activity, Users, Mail,
  MessageSquare, Calendar, Clock, Phone, Webhook, ShieldAlert,
  CheckCircle2, XCircle, ArrowRight, Plus, Edit3, X, Send, Ban,
  AlertTriangle,
} from 'lucide-react';
import { pilotApi } from '../lib/pilotApi';

// ---- Tab config ----
const TABS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: Activity },
  { id: 'leads',          label: 'Leads',          icon: Users },
  { id: 'approvals',      label: 'Approvals',      icon: Mail },
  { id: 'scheduled',      label: 'Scheduled',      icon: Calendar },
  { id: 'history',        label: 'History',        icon: Clock },
  { id: 'conversations',  label: 'Conversations',  icon: MessageSquare },
  { id: 'calls',          label: 'Calls',          icon: Phone },
  { id: 'webhooks',       label: 'Webhooks',       icon: Webhook },
];

const POLL_INTERVAL = 5000;
const CANCELLABLE_JOB_STATUSES = ['pending', 'approved'];
const CANCELLABLE_SCHEDULE_STATUSES = ['scheduled'];

const STATUS_COLORS = {
  pending: 'text-amber-400', approved: 'text-violet-400', simulated: 'text-amber-400',
  sent: 'text-sky-400', delivered: 'text-emerald-400', failed: 'text-rose-400',
  cancelled: 'text-white/40', rejected: 'text-rose-400', replied: 'text-emerald-400',
  new: 'text-sky-400', pending_approval: 'text-amber-400', contacted: 'text-violet-400',
  scheduled: 'text-sky-400', opted_out: 'text-rose-400', opted_in: 'text-emerald-400',
};

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'text-white/50';
  return <span className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{status || 'unknown'}</span>;
}

function ChannelIcon({ channel }) {
  const Icon = channel === 'sms' ? MessageSquare : channel === 'email' ? Mail : MessageSquare;
  return <Icon className="w-3.5 h-3.5 text-white/40" strokeWidth={1.5} />;
}

// ---- Empty / Error / Loading states ----
function EmptyState({ label }) {
  return <div className="text-center py-12 text-white/30 text-sm">{label || 'No data available'}</div>;
}
function ErrorState({ error }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/15 text-sm text-rose-400">
      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
      {error}
    </div>
  );
}

// ---- Toast ----
function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    info: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
  };
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm ${colors[toast.type] || colors.info}`}
      >
        {toast.msg}
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Confirm Dialog ----
function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface-100 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-base font-semibold text-white/90 mb-2">{title}</h3>
          <p className="text-sm text-white/50 mb-5">{message}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${danger ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-gold-500/15 text-gold-400 hover:bg-gold-500/25'}`}
            >
              {confirmLabel || 'Confirm'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================
// Main component
// ============================================================
export default function PilotAutomation() {
  const [tab, setTab] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [leads, setLeads] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [scheduler, setScheduler] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [calls, setCalls] = useState([]);
  const [optouts, setOptouts] = useState([]);
  const [webhookHealth, setWebhookHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, message, confirmLabel, onConfirm, danger }

  const mountedRef = useRef(true);
  const inflightRef = useRef(false);
  const toastTimerRef = useRef(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; clearTimeout(toastTimerRef.current); }; }, []);

  function showToast(msg, type = 'info') {
    if (!mountedRef.current) return;
    setToast({ msg, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => { if (mountedRef.current) setToast(null); }, 3500);
  }

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setRefreshing(true);
    try {
      const [h, l, d, j, s, c, cl, o, wh] = await Promise.all([
        pilotApi.getHealth(),
        pilotApi.getLeads(),
        pilotApi.getDrafts(),
        pilotApi.getJobs(),
        pilotApi.getScheduler(),
        pilotApi.getConversations(),
        pilotApi.getCalls(),
        pilotApi.getOptouts(),
        pilotApi.getWebhookHealth(),
      ]);
      if (!mountedRef.current) return;
      setHealth(h);
      setLeads(l.leads || []);
      setDrafts(d.drafts || []);
      setJobs(j.jobs || []);
      setScheduler(s);
      setConversations(c.conversations || []);
      setCalls(cl.calls || []);
      setOptouts(o.optouts || []);
      setWebhookHealth(wh);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (mountedRef.current) setError(e.message || String(e));
    } finally {
      inflightRef.current = false;
      if (mountedRef.current) { setRefreshing(false); setLoading(false); }
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  // ---- Safety: determine if actions are allowed ----
  // Actions are only allowed when liveMode is false (simulation) or testMode is true.
  // If liveMode is true, we disable all write actions per Stage 2B safety requirements.
  const isSimMode = health ? (!health.liveMode && health.testMode) : false;
  const actionsAllowed = isSimMode;

  // ---- Action handlers ----
  const handleCreateLead = useCallback(async (payload) => {
    try {
      const r = await pilotApi.createLead(payload);
      showToast(`Lead "${r.lead?.name || 'created'}" — ${r.drafts?.length || 0} drafts generated`, 'success');
      await refresh();
      return r;
    } catch (e) {
      showToast(e.message || 'Failed to create lead', 'error');
      throw e;
    }
  }, [refresh]);

  const handleApprove = useCallback(async (draft) => {
    setConfirm({
      title: 'Approve Draft',
      message: `Send ${draft.channel} to ${draft.to}? This will trigger the automation engine (simulated in test mode).`,
      confirmLabel: 'Approve & Send',
      danger: false,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await pilotApi.approveDraft(draft.id);
          showToast(`Draft approved — ${draft.channel} to ${draft.to}`, 'success');
          await refresh();
        } catch (e) {
          showToast(e.message || 'Approval failed', 'error');
        }
      },
    });
  }, [refresh]);

  const handleReject = useCallback(async (draft) => {
    setConfirm({
      title: 'Reject Draft',
      message: `Reject the ${draft.channel} draft to ${draft.to}? This cannot be undone.`,
      confirmLabel: 'Reject',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await pilotApi.rejectDraft(draft.id);
          showToast('Draft rejected', 'success');
          await refresh();
        } catch (e) {
          showToast(e.message || 'Reject failed', 'error');
        }
      },
    });
  }, [refresh]);

  const handleEditDraft = useCallback(async (id, patch) => {
    try {
      await pilotApi.editDraft(id, patch);
      showToast('Draft updated', 'success');
      await refresh();
    } catch (e) {
      showToast(e.message || 'Edit failed', 'error');
    }
  }, [refresh]);

  const handleCancelJob = useCallback(async (job) => {
    setConfirm({
      title: 'Cancel Job',
      message: `Cancel the ${job.channel} job to ${job.to}? Status: ${job.status}.`,
      confirmLabel: 'Cancel Job',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await pilotApi.cancelJob(job.id);
          showToast('Job cancelled', 'success');
          await refresh();
        } catch (e) {
          showToast(e.message || 'Cancel failed', 'error');
        }
      },
    });
  }, [refresh]);

  const handleCancelFollowups = useCallback(async (leadId) => {
    setConfirm({
      title: 'Cancel Follow-ups',
      message: `Cancel all scheduled follow-ups for lead …${leadId.slice(-6)}?`,
      confirmLabel: 'Cancel Follow-ups',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const r = await pilotApi.cancelFollowups(leadId);
          showToast(`Cancelled ${r.cancelled || 0} follow-up(s)`, 'success');
          await refresh();
        } catch (e) {
          showToast(e.message || 'Cancel failed', 'error');
        }
      },
    });
  }, [refresh]);

  // ---- Derived data ----
  const pendingDrafts = drafts.filter(d => d.status === 'pending');
  const scheduledItems = scheduler?.schedule || [];
  const sentJobs = jobs.filter(j => ['sent', 'simulated', 'delivered'].includes(j.status));
  const failedJobs = jobs.filter(j => j.status === 'failed');

  // ---- Render ----
  if (loading && !health) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gold-400 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast toast={toast} />
      <ConfirmDialog {...(confirm || {})} onCancel={() => setConfirm(null)} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white/90">Automation Pilot</h1>
            <p className="text-xs text-white/40">
              {lastRefresh ? `Updated ${fmtTime(lastRefresh.toISOString())}` : 'Loading…'}
              {refreshing && ' · refreshing…'}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/60 hover:text-white/90 hover:border-white/[0.12] transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          Refresh
        </button>
      </div>

      {/* Mode banner */}
      {health && <ModeBanner health={health} actionsAllowed={actionsAllowed} />}
      {!health && !loading && (
        <div className="flex items-center gap-2 ml-auto px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
          Actions disabled — waiting for system mode verification.
        </div>
      )}

      {/* Error */}
      {error && <ErrorState error={error} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.04] pb-px overflow-x-auto scrollable">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-medium transition-all whitespace-nowrap
                ${isActive ? 'text-gold-400 bg-gold-500/5' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'}`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {t.label}
              {t.id === 'approvals' && pendingDrafts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">{pendingDrafts.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'dashboard' && <DashboardTab health={health} leads={leads} pendingDrafts={pendingDrafts} scheduledItems={scheduledItems} jobs={jobs} sentJobs={sentJobs} failedJobs={failedJobs} />}
          {tab === 'leads' && <LeadsTab leads={leads} actionsAllowed={actionsAllowed} onCreateLead={handleCreateLead} showToast={showToast} />}
          {tab === 'approvals' && <ApprovalsTab drafts={drafts} pendingDrafts={pendingDrafts} actionsAllowed={actionsAllowed} onApprove={handleApprove} onReject={handleReject} onEdit={handleEditDraft} showToast={showToast} />}
          {tab === 'scheduled' && <ScheduledTab scheduler={scheduler} scheduledItems={scheduledItems} actionsAllowed={actionsAllowed} onCancelFollowups={handleCancelFollowups} />}
          {tab === 'history' && <HistoryTab jobs={jobs} actionsAllowed={actionsAllowed} onCancelJob={handleCancelJob} />}
          {tab === 'conversations' && <ConversationsTab conversations={conversations} />}
          {tab === 'calls' && <CallsTab calls={calls} />}
          {tab === 'webhooks' && <WebhooksTab webhookHealth={webhookHealth} optouts={optouts} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Mode Banner (with safety warning)
// ============================================================
function ModeBanner({ health, actionsAllowed }) {
  const live = health.liveMode;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
      ${live ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-400'}`}>
      <div className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="font-semibold">{live ? 'LIVE MODE' : 'SIMULATION MODE'}</span>
      <span className="text-white/40">
        {live ? 'Real sends enabled — Twilio + Resend will be called.' : 'No external APIs called.'}
      </span>
      {(health.configIssues || []).length > 0 && (
        <span className="text-rose-400/80">⚠ {health.configIssues.join('; ')}</span>
      )}
      {!actionsAllowed && (
        <div className="flex items-center gap-2 ml-auto px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
          {health.liveMode
            ? 'Actions disabled — live mode is active.'
            : 'Actions disabled — simulation/test mode is not enabled.'}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard Tab — read-only metrics
// ============================================================
function DashboardTab({ health, leads, pendingDrafts, scheduledItems, jobs, sentJobs, failedJobs }) {
  const metrics = [
    { label: 'Total Leads', value: leads.length, icon: Users, color: 'gold' },
    { label: 'Pending Approvals', value: pendingDrafts.length, icon: Mail, color: 'amber' },
    { label: 'Scheduled', value: scheduledItems.length, icon: Calendar, color: 'sky' },
    { label: 'Sent / Simulated', value: sentJobs.length, icon: CheckCircle2, color: 'emerald' },
    { label: 'Failed', value: failedJobs.length, icon: XCircle, color: 'rose' },
    { label: 'Total Jobs', value: jobs.length, icon: Clock, color: 'purple' },
  ];
  const colorMap = {
    gold: 'text-gold-400 bg-gold-500/10', amber: 'text-amber-400 bg-amber-500/10',
    sky: 'text-sky-400 bg-sky-500/10', emerald: 'text-emerald-400 bg-emerald-500/10',
    rose: 'text-rose-400 bg-rose-500/10', purple: 'text-violet-400 bg-violet-500/10',
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="p-4 rounded-xl bg-surface-100/80 border border-white/[0.05]">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] uppercase tracking-widest text-white/30 font-medium">{m.label}</span>
                <div className={`w-8 h-8 rounded-lg ${colorMap[m.color]} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
              </div>
              <span className="text-2xl font-bold text-white/90">{m.value}</span>
            </div>
          );
        })}
      </div>
      {health && (
        <div className="p-4 rounded-xl bg-surface-100/80 border border-white/[0.05]">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Provider Status</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ProviderStatus label="OpenRouter" ok={health.hasOpenRouter} detail={health.model} />
            <ProviderStatus label="Twilio" ok={health.hasTwilio} detail="SMS + Voice" />
            <ProviderStatus label="Resend" ok={health.hasResend} detail="Email" />
            <ProviderStatus label="Call Forward" ok={health.forwardPhone === 'configured'} detail={health.forwardPhone} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderStatus({ label, ok, detail }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
          : <XCircle className="w-4 h-4 text-rose-400/60 flex-shrink-0" strokeWidth={1.5} />}
      <div className="min-w-0">
        <div className="text-sm font-medium text-white/80">{label}</div>
        <div className="text-[11px] text-white/30 truncate">{ok ? (detail || 'configured') : 'not configured'}</div>
      </div>
    </div>
  );
}

// ============================================================
// Leads Tab — with creation form
// ============================================================
function LeadsTab({ leads, actionsAllowed, onCreateLead, showToast }) {
  const [showForm, setShowForm] = useState(false);
  if (!actionsAllowed && !leads.length) return <EmptyState label="No leads yet — switch to simulation mode to create leads" />;
  return (
    <div className="space-y-3">
      {actionsAllowed && (
        <LeadForm
          open={showForm}
          onToggle={() => setShowForm(s => !s)}
          onCreate={onCreateLead}
          showToast={showToast}
        />
      )}
      {!actionsAllowed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/15 text-xs text-rose-400">
          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
          Lead creation disabled — live mode is active
        </div>
      )}
      {!leads.length ? (
        <EmptyState label="No leads yet" />
      ) : (
        leads.map(l => (
          <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/90">{l.name || '(no name)'}</span>
                <StatusBadge status={l.status} />
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {l.phone || '—'} · {l.email || '—'} · {l.source}
              </div>
            </div>
            <div className="text-xs text-white/30 text-right whitespace-nowrap">
              {l.businessName}<br />{fmtTime(l.createdAt)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LeadForm({ open, onToggle, onCreate, showToast }) {
  const [form, setForm] = useState({ name: '', businessName: '', phone: '', email: '', notes: '', source: 'website_form' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e = {};
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!name && !phone && !email) e._ = 'At least name, phone, or email is required';
    if (phone && !/^\+?[\d\s()-]{7,}$/.test(phone)) e.phone = 'Invalid phone format (e.g. +15551234567)';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim() || undefined,
        businessName: form.businessName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        source: form.source.trim() || 'website_form',
      };
      await onCreate(payload);
      setForm({ name: '', businessName: '', phone: '', email: '', notes: '', source: 'website_form' });
      onToggle(); // close form
    } catch {
      // error already shown via toast
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-sm text-gold-400 hover:bg-gold-500/15 transition-all"
      >
        <Plus className="w-4 h-4" strokeWidth={1.5} />
        Create Lead
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-surface-100/80 border border-white/[0.05]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80">Create Lead</h3>
        <button onClick={onToggle} className="text-white/30 hover:text-white/60 transition-all">
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {errors._ && <div className="text-xs text-rose-400">{errors._}</div>}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Jane Doe" />
          <FormField label="Business" value={form.businessName} onChange={v => setForm(f => ({ ...f, businessName: v }))} placeholder="Acme Corp" />
          <FormField label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+15551234567" error={errors.phone} />
          <FormField label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="jane@example.com" error={errors.email} />
        </div>
        <FormField label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Customer inquiry about…" textarea />
        <FormField label="Source" value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))} placeholder="website_form" />
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500/15 text-gold-400 text-sm font-medium hover:bg-gold-500/25 transition-all disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {submitting ? 'Creating…' : 'Create Lead'}
          </button>
          <button type="button" onClick={onToggle} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, error, textarea }) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="modal-input"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="modal-input"
        />
      )}
      {error && <div className="text-xs text-rose-400 mt-1">{error}</div>}
    </div>
  );
}

// ============================================================
// Approvals Tab — with approve/reject/edit controls
// ============================================================
function ApprovalsTab({ drafts, pendingDrafts, actionsAllowed, onApprove, onReject, onEdit, showToast }) {
  const [editingId, setEditingId] = useState(null);

  if (!actionsAllowed) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/15 text-xs text-rose-400">
          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
          Approve / reject / edit disabled — live mode is active
        </div>
        <DraftsList drafts={drafts} pendingDrafts={pendingDrafts} readOnly />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!pendingDrafts.length ? (
        <EmptyState label="No pending drafts" />
      ) : (
        pendingDrafts.map(d => (
          <DraftCard
            key={d.id}
            draft={d}
            onApprove={() => onApprove(d)}
            onReject={() => onReject(d)}
            onEdit={(patch) => onEdit(d.id, patch)}
            isEditing={editingId === d.id}
            setEditing={(v) => setEditingId(v ? d.id : null)}
            showToast={showToast}
          />
        ))
      )}
      {drafts.filter(d => d.status !== 'pending').length > 0 && (
        <div className="pt-3">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Processed Drafts</h3>
          {drafts.filter(d => d.status !== 'pending').map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.01] border border-white/[0.03] mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <ChannelIcon channel={d.channel} />
                <span className="text-xs text-white/60 truncate">{d.to}</span>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftsList({ drafts, pendingDrafts, readOnly }) {
  return (
    <>
      {!pendingDrafts.length ? <EmptyState label="No pending drafts" /> : (
        pendingDrafts.map(d => (
          <div key={d.id} className="px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <ChannelIcon channel={d.channel} />
                <span className="text-sm font-medium text-white/90">{d.to}</span>
                <StatusBadge status={d.status} />
              </div>
              <span className="text-xs text-white/30">{fmtTime(d.createdAt)}</span>
            </div>
            {d.subject && <div className="text-xs text-white/50 mb-1">Subject: {d.subject}</div>}
            <div className="text-xs text-white/60 bg-white/[0.02] rounded-lg p-2.5 max-h-24 overflow-y-auto scrollable whitespace-pre-wrap">{d.body}</div>
          </div>
        ))
      )}
    </>
  );
}

function DraftCard({ draft, onApprove, onReject, onEdit, isEditing, setEditing, showToast }) {
  const [editBody, setEditBody] = useState(draft.body);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [busy, setBusy] = useState(false);

  async function handleSaveEdit() {
    setBusy(true);
    try {
      await onEdit({ body: editBody.trim(), subject: draft.channel === 'email' ? editSubject.trim() : undefined });
      setEditing(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <ChannelIcon channel={draft.channel} />
          <span className="text-sm font-medium text-white/90">{draft.to}</span>
          <StatusBadge status={draft.status} />
        </div>
        <span className="text-xs text-white/30">{fmtTime(draft.createdAt)}</span>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {draft.channel === 'email' && (
            <input
              type="text"
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
              placeholder="Subject"
              className="modal-input"
            />
          )}
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={4}
            className="modal-input"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/15 text-gold-400 text-xs font-medium hover:bg-gold-500/25 transition-all disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} /> : <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />}
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setEditBody(draft.body); setEditSubject(draft.subject); }}
              className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {draft.subject && <div className="text-xs text-white/50 mb-1">Subject: {draft.subject}</div>}
          <div className="text-xs text-white/60 bg-white/[0.02] rounded-lg p-2.5 max-h-24 overflow-y-auto scrollable whitespace-pre-wrap">{draft.body}</div>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all"
            >
              <Send className="w-3 h-3" strokeWidth={1.5} />
              Approve & Send
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-medium hover:bg-rose-500/25 transition-all"
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
              Reject
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/60 text-xs font-medium hover:bg-white/[0.08] transition-all"
            >
              <Edit3 className="w-3 h-3" strokeWidth={1.5} />
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Scheduled Tab — with cancel follow-ups
// ============================================================
function ScheduledTab({ scheduler, scheduledItems, actionsAllowed, onCancelFollowups }) {
  // Group scheduled items by leadId so we can show one cancel button per lead
  const byLead = {};
  for (const s of scheduledItems) {
    if (!byLead[s.leadId]) byLead[s.leadId] = [];
    byLead[s.leadId].push(s);
  }
  const leadIds = Object.keys(byLead);

  return (
    <div className="space-y-2">
      {scheduler?.status && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-white/40">
          <span>Scheduled: <strong className="text-white/70">{scheduler.status.scheduled}</strong></span>
          <span>Cancelled: <strong className="text-white/70">{scheduler.status.cancelled}</strong></span>
          <span>Follow-up delay: <strong className="text-white/70">{scheduler.status.testFollowupMinutes}m</strong></span>
          <span>Poll: <strong className="text-white/70">{scheduler.status.pollSeconds}s</strong></span>
        </div>
      )}
      {!scheduledItems.length ? (
        <EmptyState label="Nothing scheduled" />
      ) : (
        leadIds.map(lid => (
          <div key={lid} className="px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-sm text-white/80">Lead …{lid?.slice(-6)}</div>
              {actionsAllowed && (
                <button
                  onClick={() => onCancelFollowups(lid)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-xs hover:bg-rose-500/20 transition-all"
                >
                  <Ban className="w-3 h-3" strokeWidth={1.5} />
                  Cancel Follow-ups
                </button>
              )}
            </div>
            <div className="space-y-1">
              {byLead[lid].map(s => (
                <div key={s.id} className="flex items-center gap-3 text-xs text-white/40 pl-2">
                  <ChannelIcon channel={s.channel} />
                  <span>Run at {fmtTime(s.runAt)}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// History Tab — with cancel job
// ============================================================
function HistoryTab({ jobs, actionsAllowed, onCancelJob }) {
  return (
    <div className="space-y-2">
      {!jobs.length ? (
        <EmptyState label="No jobs yet" />
      ) : (
        jobs.slice(0, 20).map(j => {
          const canCancel = actionsAllowed && CANCELLABLE_JOB_STATUSES.includes(j.status);
          return (
            <div key={j.id} className="px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ChannelIcon channel={j.channel} />
                  <span className="text-sm text-white/80">{j.to}</span>
                  <StatusBadge status={j.status} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">{fmtTime(j.createdAt)}</span>
                  {canCancel && (
                    <button
                      onClick={() => onCancelJob(j)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-xs hover:bg-rose-500/20 transition-all"
                    >
                      <Ban className="w-3 h-3" strokeWidth={1.5} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-white/40 mt-1 flex items-center gap-3">
                {j.externalId && <span>ext: {j.externalId.slice(0, 14)}…</span>}
                {j.attempts > 0 && <span>attempts: {j.attempts}</span>}
                {j.lastError && <span className="text-rose-400/70">err: {j.lastError}</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// Conversations Tab — read-only
// ============================================================
function ConversationsTab({ conversations }) {
  if (!conversations.length) return <EmptyState label="No conversations yet" />;
  return (
    <div className="space-y-2">
      {conversations.map(c => (
        <div key={c.id || c.from + c.at} className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80">{c.from || '—'}</span>
              <span className="text-[10px] text-white/30 uppercase">{c.direction || c.action}</span>
            </div>
            <div className="text-xs text-white/50 mt-0.5">{c.body}</div>
          </div>
          <span className="text-xs text-white/30 whitespace-nowrap">{fmtTime(c.at)}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Calls Tab — read-only
// ============================================================
function CallsTab({ calls }) {
  if (!calls.length) return <EmptyState label="No calls yet" />;
  return (
    <div className="space-y-2">
      {calls.map(c => (
        <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-white/40" strokeWidth={1.5} />
            <span className="text-sm text-white/80">{c.from || '—'} → {c.to || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <span className="text-xs text-white/30">{fmtTime(c.at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Webhooks Tab — read-only health + opt-outs
// ============================================================
function WebhooksTab({ webhookHealth, optouts }) {
  return (
    <div className="space-y-4">
      {webhookHealth ? (
        <div className="p-4 rounded-xl bg-surface-100/80 border border-white/[0.05]">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Webhook Endpoints</h3>
          <div className="space-y-2">
            {Object.entries(webhookHealth.endpoints || {}).map(([key, url]) => (
              <div key={key} className="flex items-center gap-3 text-xs">
                <ArrowRight className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                <span className="text-white/50 w-28">{key}</span>
                <span className="text-white/40 font-mono truncate">{url}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-2 text-xs">
              {webhookHealth.twilioSecretConfigured
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                : <XCircle className="w-3.5 h-3.5 text-rose-400/60" strokeWidth={1.5} />}
              <span className="text-white/50">Twilio signature verification</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {webhookHealth.resendSecretConfigured
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                : <XCircle className="w-3.5 h-3.5 text-rose-400/60" strokeWidth={1.5} />}
              <span className="text-white/50">Resend signature verification</span>
            </div>
          </div>
        </div>
      ) : <EmptyState label="Webhook health unavailable" />}

      <div>
        <h3 className="text-sm font-semibold text-white/70 mb-2">Opt-Out Registry</h3>
        {!optouts.length ? (
          <EmptyState label="No opt-outs recorded" />
        ) : (
          optouts.map(o => (
            <div key={o.phone} className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-1">
              <span className="text-sm text-white/70 font-mono">{o.phone}</span>
              <StatusBadge status={o.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
