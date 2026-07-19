import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, RefreshCw, Loader2, AlertCircle, Activity, Users, Mail,
  MessageSquare, Calendar, Clock, Phone, Webhook, ShieldX,
  CheckCircle2, XCircle, ArrowRight,
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

function ComingSoon({ label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-white/30">
      <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
      {label || 'Coming in the next stage'}
    </div>
  );
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

// ---- Main component ----
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

  const mountedRef = useRef(true);
  const inflightRef = useRef(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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

  // Single polling interval, cleaned up on unmount
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
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
      {health && <ModeBanner health={health} />}

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
          {tab === 'leads' && <LeadsTab leads={leads} />}
          {tab === 'approvals' && <ApprovalsTab drafts={drafts} pendingDrafts={pendingDrafts} />}
          {tab === 'scheduled' && <ScheduledTab scheduler={scheduler} scheduledItems={scheduledItems} />}
          {tab === 'history' && <HistoryTab jobs={jobs} />}
          {tab === 'conversations' && <ConversationsTab conversations={conversations} />}
          {tab === 'calls' && <CallsTab calls={calls} />}
          {tab === 'webhooks' && <WebhooksTab webhookHealth={webhookHealth} optouts={optouts} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Mode Banner
// ============================================================
function ModeBanner({ health }) {
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
      {/* Metrics grid */}
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

      {/* Provider status */}
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
// Leads Tab — read-only
// ============================================================
function LeadsTab({ leads }) {
  if (!leads.length) return <EmptyState label="No leads yet" />;
  return (
    <div className="space-y-2">
      <ComingSoon label="Lead creation coming in the next stage" />
      {leads.map(l => (
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
      ))}
    </div>
  );
}

// ============================================================
// Approvals Tab — read-only pending drafts
// ============================================================
function ApprovalsTab({ drafts, pendingDrafts }) {
  return (
    <div className="space-y-2">
      <ComingSoon label="Approve / reject / edit controls coming in the next stage" />
      {!pendingDrafts.length ? (
        <EmptyState label="No pending drafts" />
      ) : (
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
      {/* Also show approved/rejected drafts for context */}
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

// ============================================================
// Scheduled Tab — read-only
// ============================================================
function ScheduledTab({ scheduler, scheduledItems }) {
  return (
    <div className="space-y-2">
      <ComingSoon label="Cancel follow-up controls coming in the next stage" />
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
        scheduledItems.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
            <div className="flex items-center gap-3">
              <ChannelIcon channel={s.channel} />
              <div>
                <div className="text-sm text-white/80">Lead …{s.leadId?.slice(-6)}</div>
                <div className="text-xs text-white/40">Run at {fmtTime(s.runAt)}</div>
              </div>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// History Tab — read-only job list
// ============================================================
function HistoryTab({ jobs }) {
  return (
    <div className="space-y-2">
      <ComingSoon label="Cancel job controls coming in the next stage" />
      {!jobs.length ? (
        <EmptyState label="No jobs yet" />
      ) : (
        jobs.slice(0, 20).map(j => (
          <div key={j.id} className="px-4 py-3 rounded-xl bg-surface-100/60 border border-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ChannelIcon channel={j.channel} />
                <span className="text-sm text-white/80">{j.to}</span>
                <StatusBadge status={j.status} />
              </div>
              <span className="text-xs text-white/30">{fmtTime(j.createdAt)}</span>
            </div>
            <div className="text-xs text-white/40 mt-1 flex items-center gap-3">
              {j.externalId && <span>ext: {j.externalId.slice(0, 14)}…</span>}
              {j.attempts > 0 && <span>attempts: {j.attempts}</span>}
              {j.lastError && <span className="text-rose-400/70">err: {j.lastError}</span>}
            </div>
          </div>
        ))
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
      {/* Webhook endpoints */}
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

      {/* Opt-outs */}
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
