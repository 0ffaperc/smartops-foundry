import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, CalendarDays, BarChart3, BookOpen, Shield, AlertTriangle,
  ChevronLeft, ChevronRight, Save, Crosshair, Target, Gauge, FlaskConical, Lock,
} from 'lucide-react';
import GlowCard from '../components/GlowCard';
import MetricCard from '../components/MetricCard';
import { loadBacktest, loadNotes, saveNote, getNote } from '../lib/backtestData';
import PropFirmSim from './PropFirmSim';

const MODES = [
  { id: 'oneBest', label: 'One-Best / Day', sub: 'LIVE DEFAULT', icon: Target, color: 'emerald', live: true },
  { id: 'twoMax', label: 'Two-Max / Day', sub: 'AGGRESSIVE', icon: TrendingUp, color: 'gold', live: true, comingSoon: true },
  { id: 'allSelected', label: 'All-Selected', sub: 'RESEARCH ONLY · NEVER LIVE', icon: FlaskConical, color: 'rose', live: false, comingSoon: true },
];

const REFLECTION_FIELDS = [
  ['setup', 'What was the setup?'],
  ['swept', 'Which high/low was swept?'],
  ['refused', 'Which asset refused?'],
  ['referee', 'What did the referee asset do?'],
  ['confirmed', 'What confirmed?'],
  ['invalidated', 'What invalidated (or would have)?'],
  ['whyAsset', 'Why did we trade this asset today?'],
  ['whyNotOther', 'Why did we not take the other setup?'],
  ['lesson', 'What lesson should I replay on TradingView?'],
];

const fmt = (n, d = 1) => (n === Infinity ? '∞' : Number(n).toFixed(d));
const COLORS = { up: '#34d399', down: '#fb7185', gold: '#e8b923', blue: '#5b9bd5', purple: '#a78bfa' };

function StatPill({ label, value, tone }) {
  const c = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-white/70';
  return (
    <div className="px-3 py-2 rounded-lg bg-surface-200/40 border border-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wider text-white/25">{label}</div>
      <div className={`text-sm font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function chip(text, tone = 'neutral') {
  const map = {
    buy: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20',
    sell: 'bg-rose-500/12 text-rose-300 border-rose-500/20',
    win: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20',
    loss: 'bg-rose-500/12 text-rose-300 border-rose-500/20',
    neutral: 'bg-surface-200/50 text-white/55 border-white/[0.06]',
    info: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${map[tone] || map.neutral}`}>{text}</span>;
}

export default function BacktestJournal() {
  const [mode, setMode] = useState('oneBest');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview'); // overview | replay | months | weeks | breakdowns
  const [dayIdx, setDayIdx] = useState(0);
  const [notes, setNotes] = useState(() => loadNotes());
  const [draft, setDraft] = useState({});
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    loadBacktest(mode)
      .then((d) => { if (alive) { setData(d); setDayIdx(0); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [mode]);

  const day = data?.days?.[dayIdx];
  const status = MODES.find((m) => m.id === mode);

  useEffect(() => {
    if (day) setDraft(getNote(notes, mode, day.date));
  }, [dayIdx, day, notes, mode]);

  const persist = () => {
    if (!day) return;
    const all = saveNote(mode, day.date, draft);
    setNotes(all);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const o = data?.overall;

  // chart data
  const equityData = useMemo(() => (data?.equity || []).map((e) => ({ date: e.date, cumR: e.cumR })), [data]);
  const monthBars = useMemo(() => (data?.monthly || []).map((m) => ({ key: m.key.slice(2), totalR: m.totalR, winPct: m.winPct })), [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-gold-400" strokeWidth={1.5} />
            Backtest Journal
          </h1>
          <p className="text-white/40 mt-1 text-sm">System V3 · NQ / ES / YM · daily replay & stats</p>
        </div>
        {data && (
          <div className="text-xs text-white/40 text-right">
            <div>{data.firstDate} → {data.lastDate}</div>
            <div>{data.days.length} trading days loaded</div>
          </div>
        )}
      </div>

      {/* Core reminder */}
      <GlowCard glowColor="gold">
        <div className="flex items-start gap-3">
          <Crosshair className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-gold-400 font-semibold">The variable is not the trade. The full stack is the trade:</span>{' '}
            best asset/side + sweep/refusal or continuation break + referee no conflict + IFVG/MSS + reasonable stop + 1R speed/MAE for management.
          </p>
        </div>
      </GlowCard>

      {/* Mode selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((m) => {
          const active = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => !m.comingSoon && setMode(m.id)}
              disabled={m.comingSoon}
              className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden ${
                active ? `border-${m.color}-500/40 bg-${m.color}-500/8` : 'border-white/[0.06] bg-surface-200/40 hover:border-white/15'
              } ${m.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 text-${m.color}-400`} strokeWidth={1.5} />
                <span className="font-semibold text-sm">{m.label}</span>
                {!m.live && <Lock className="w-3 h-3 text-rose-400" strokeWidth={2} />}
              </div>
              <div className={`text-[10px] uppercase tracking-wider ${m.live ? 'text-white/30' : 'text-rose-400/70'}`}>{m.sub}</div>
              {m.comingSoon && <div className="text-[10px] text-white/25 mt-1">data not loaded yet</div>}
            </button>
          );
        })}
      </div>

      {loading && <GlowCard><p className="text-white/40 text-sm py-8 text-center">Loading backtest data…</p></GlowCard>}
      {error && (
        <GlowCard glowColor="rose">
          <div className="flex items-center gap-2 text-rose-300 text-sm"><AlertTriangle className="w-4 h-4" /> {error}</div>
          <p className="text-xs text-white/40 mt-2">Expected CSV at <code>/v3data/day_by_day_one_best_full.csv</code>.</p>
        </GlowCard>
      )}

      {data && !loading && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label="Total R" value={fmt(o.totalR, 1)} subtitle={`${o.trades} trades`} icon={TrendingUp} color={o.totalR >= 0 ? 'emerald' : 'rose'} glow />
            <MetricCard label="Win %" value={`${fmt(o.winPct, 0)}%`} subtitle={`${o.wins}/${o.trades}`} icon={Target} color="gold" glow />
            <MetricCard label="Avg R" value={fmt(o.avgR, 2)} subtitle="per trade" icon={Gauge} color="blue" glow />
            <MetricCard label="Profit Factor" value={fmt(o.pf, 2)} subtitle="gross win/loss" icon={BarChart3} color="purple" glow />
            <MetricCard label="Max DD" value={fmt(o.maxDD, 1)} subtitle={`${o.maxLossStreak} loss streak`} icon={Shield} color="rose" glow />
          </div>

          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            {[['overview', 'Overview'], ['replay', 'Daily Replay'], ['months', 'Months'], ['weeks', 'Weeks'], ['breakdowns', 'Breakdowns'], ['propsim', 'Prop Firm Sim']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${tab === id ? 'bg-gold-500/10 text-gold-400 border-gold-500/20' : 'bg-surface-200/40 text-white/40 border-white/[0.04] hover:text-white/60'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlowCard glowColor="emerald" className="lg:col-span-2">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Equity Curve (cumulative R)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={equityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff40' }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} />
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Line type="monotone" dataKey="cumR" stroke={COLORS.up} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </GlowCard>
              <GlowCard glowColor="gold" className="lg:col-span-2">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gold-400" /> Monthly R</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="key" tick={{ fontSize: 9, fill: '#ffffff40' }} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} />
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Bar dataKey="totalR" isAnimationActive={false}>
                      {monthBars.map((m, i) => <Cell key={i} fill={m.totalR >= 0 ? COLORS.up : COLORS.down} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </GlowCard>
            </div>
          )}

          {/* DAILY REPLAY */}
          {tab === 'replay' && day && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlowCard glowColor="blue">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setDayIdx((i) => Math.max(0, i - 1))} className="p-2 rounded-lg bg-surface-200/50 border border-white/[0.06] hover:border-white/15 disabled:opacity-30" disabled={dayIdx === 0}><ChevronLeft className="w-4 h-4" /></button>
                  <div className="text-center">
                    <div className="text-lg font-bold flex items-center gap-2 justify-center"><CalendarDays className="w-4 h-4 text-blue-400" /> {day.date}</div>
                    <div className="text-[11px] text-white/30">day {dayIdx + 1} of {data.days.length}</div>
                  </div>
                  <button onClick={() => setDayIdx((i) => Math.min(data.days.length - 1, i + 1))} className="p-2 rounded-lg bg-surface-200/50 border border-white/[0.06] hover:border-white/15 disabled:opacity-30" disabled={dayIdx === data.days.length - 1}><ChevronRight className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {chip(`${day.asset_to_trade_today} ${day.side_to_trade}`, day.side_to_trade === 'BUY' ? 'buy' : 'sell')}
                  {chip(day.entry_model, 'info')}
                  {chip(day.playbook_window)}
                  {chip(`${day._R > 0 ? '+' : ''}${day._R}R`, day._R > 0 ? 'win' : 'loss')}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <StatPill label="Sweep Anchor" value={day.sweep_anchor} />
                  <StatPill label="Referee" value={`${day.middle_referee_asset} · ${day.referee_no_conflict === 'True' ? 'clean' : 'conflict'}`} />
                  <StatPill label="Confirmation" value={day.confirmation} />
                  <StatPill label="1R Speed" value={day.hit_1R_speed_bucket} tone={day.hit_1R_speed_bucket?.startsWith('FAST') ? 'up' : day.hit_1R_speed_bucket === 'NO_1R' ? 'down' : 'neutral'} />
                  <StatPill label="Target" value={day.system_v3_target} />
                  <StatPill label="Risk (pts)" value={day.risk_points} />
                  <StatPill label="MFE" value={`${fmt(day.MFE_R, 1)}R`} tone="up" />
                  <StatPill label="MAE" value={`${fmt(day.MAE_R, 1)}R`} tone="down" />
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface-200/40 border border-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Management V3</div>
                    <p className="text-white/65">{day.management_v3}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-200/40 border border-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Trade Instruction</div>
                    <p className="text-white/65">{day.trade_instruction}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/[0.05] border border-rose-500/[0.12]">
                    <div className="text-[10px] uppercase tracking-wider text-rose-400/60 mb-1">Invalidations</div>
                    <p className="text-white/55">{day.invalidations}</p>
                  </div>
                </div>
              </GlowCard>

              {/* Reflection */}
              <GlowCard glowColor="purple">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent-purple" /> Replay Notes — {day.date}</h3>
                  <button onClick={persist} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-xs font-medium hover:bg-accent-purple/15">
                    <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Saved' : 'Save'}
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[440px] overflow-y-auto scrollable pr-1">
                  {/* status toggles */}
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {['taken', 'skipped_not_best', 'skipped_invalidated', 'blocked_overtrading'].map((s) => (
                      <button key={s} onClick={() => setDraft((d) => ({ ...d, status: s }))}
                        className={`px-2 py-1 rounded-md text-[11px] border ${draft.status === s ? 'bg-gold-500/12 text-gold-300 border-gold-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <input type="checkbox" checked={!!draft.protectedAfter1R} onChange={(e) => setDraft((d) => ({ ...d, protectedAfter1R: e.target.checked }))} /> Protected after 1R
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <input type="checkbox" checked={!!draft.oneRfast} onChange={(e) => setDraft((d) => ({ ...d, oneRfast: e.target.checked }))} /> 1R hit fast
                    </label>
                  </div>
                  {REFLECTION_FIELDS.map(([k, label]) => (
                    <div key={k}>
                      <label className="text-[10px] uppercase tracking-wider text-white/25">{label}</label>
                      <textarea
                        value={draft[k] || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        rows={k === 'lesson' ? 2 : 1}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.06] text-xs text-white placeholder:text-white/15 focus:border-accent-purple/30 resize-none"
                        placeholder="…"
                      />
                    </div>
                  ))}
                </div>
              </GlowCard>
            </div>
          )}

          {/* MONTHS */}
          {tab === 'months' && <StatsTable rows={data.monthly} title="Month-by-Month" />}
          {/* WEEKS */}
          {tab === 'weeks' && <StatsTable rows={data.weekly} title="Week-by-Week" />}

          {/* BREAKDOWNS */}
          {tab === 'breakdowns' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BreakdownCard title="Asset / Side" rows={data.byAssetSide} color="emerald" />
              <BreakdownCard title="Model Family" rows={data.byModel} color="gold" />
              <BreakdownCard title="Time Window" rows={data.byWindow} color="blue" />
              <BreakdownCard title="1R Speed" rows={data.bySpeed} color="purple" />
            </div>
          )}

          {/* PROP FIRM SIM */}
          {tab === 'propsim' && <PropFirmSim days={data.days} />}
        </>
      )}
    </div>
  );
}

function StatsTable({ rows, title }) {
  return (
    <GlowCard glowColor="gold">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto scrollable">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
              {['Period', 'Trades', 'Win%', 'Total R', 'Avg R', 'PF', 'Max DD', 'Streak'].map((h) => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="py-1.5 px-2 font-medium text-white/70">{r.key}</td>
                <td className="py-1.5 px-2 text-white/50">{r.trades}</td>
                <td className="py-1.5 px-2 text-white/50">{fmt(r.winPct, 0)}%</td>
                <td className={`py-1.5 px-2 font-semibold ${r.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.totalR >= 0 ? '+' : ''}{fmt(r.totalR, 1)}</td>
                <td className="py-1.5 px-2 text-white/50">{fmt(r.avgR, 2)}</td>
                <td className="py-1.5 px-2 text-white/50">{fmt(r.pf, 2)}</td>
                <td className="py-1.5 px-2 text-rose-400/70">{fmt(r.maxDD, 1)}</td>
                <td className="py-1.5 px-2 text-white/40">{r.maxLossStreak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlowCard>
  );
}

function BreakdownCard({ title, rows, color }) {
  return (
    <GlowCard glowColor={color}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between p-2 rounded-lg bg-surface-200/40 border border-white/[0.03]">
            <span className="text-xs text-white/65 truncate flex-1">{r.key}</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-white/35">{r.trades}t</span>
              <span className="text-white/45">{fmt(r.winPct, 0)}%</span>
              <span className={`font-semibold ${r.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.totalR >= 0 ? '+' : ''}{fmt(r.totalR, 1)}R</span>
            </div>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
