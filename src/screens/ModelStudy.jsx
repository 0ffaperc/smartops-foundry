import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, Layers, Clock, Anchor, Users, Gauge, Shield,
  BookMarked, Brain, ChevronLeft, ChevronRight, Eye, EyeOff, Sparkles, AlertTriangle, Lock, FlaskConical,
} from 'lucide-react';
import GlowCard from '../components/GlowCard';
import ManualBacktester from './ManualBacktester';
import {
  ONE_LINE, CORE_IDEA, BASE_STATS, FAMILIES, ROLES, REFEREE_RULES, ANCHORS,
  WINDOWS, VARIABLE_QUALITY, MANAGEMENT, INVALIDATIONS, EXAMPLES,
} from '../lib/modelCard';

const fmt = (n, d = 2) => Number(n).toFixed(d);
const toneText = (t) => (t === 'buy' ? 'text-emerald-400' : t === 'sell' ? 'text-rose-400' : 'text-white/70');
const toneBg = (t) => (t === 'buy' ? 'emerald' : t === 'sell' ? 'rose' : 'gold');

function DataTable({ rows, cols = ['Setup', 'Trades', 'Win%', 'AvgR', 'PF', 'Total R'] }) {
  return (
    <div className="overflow-x-auto scrollable mt-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
            {cols.map((c) => <th key={c} className="text-left py-1.5 px-2">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.03]">
              <td className="py-1 px-2 text-white/65">{r[0]}</td>
              <td className="py-1 px-2 text-white/45">{r[1]}</td>
              <td className="py-1 px-2 text-white/45">{fmt(r[2], 1)}%</td>
              <td className="py-1 px-2 text-white/45">{fmt(r[3])}R</td>
              <td className="py-1 px-2 text-white/45">{fmt(r[4])}</td>
              <td className="py-1 px-2 text-emerald-400 font-semibold">+{fmt(r[5], 1)}R</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  ['overview', 'Overview', Sparkles],
  ['families', 'Families', Layers],
  ['windows', 'Windows', Clock],
  ['anchors', 'Anchors & Roles', Anchor],
  ['scorecard', 'Scorecard', Gauge],
  ['examples', 'Examples', BookMarked],
  ['drill', 'Flashcard Drill', Brain],
  ['backtest', 'Manual Backtester', FlaskConical],
];

export default function ModelStudy() {
  const [tab, setTab] = useState('overview');
  const [exIdx, setExIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const ex = EXAMPLES[exIdx];
  const card = FAMILIES[cardIdx % FAMILIES.length];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-gold-400" strokeWidth={1.5} />
          Model Study
        </h1>
        <p className="text-white/40 mt-1 text-sm">AM Model Scorecard · System V3 · study, memorize, internalize</p>
      </div>

      {/* The one line */}
      <GlowCard glowColor="gold">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-base text-white/85 leading-relaxed font-medium">{ONE_LINE}</p>
        </div>
      </GlowCard>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${tab === id ? 'bg-gold-500/10 text-gold-400 border-gold-500/20' : 'bg-surface-200/40 text-white/40 border-white/[0.04] hover:text-white/60'}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} /> {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <GlowCard glowColor="blue">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-blue-400" /> Core Idea</h3>
            <p className="text-sm text-white/65 leading-relaxed mb-3">{CORE_IDEA.summary}</p>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">The full stack IS the trade:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CORE_IDEA.fullStack.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-surface-200/40 border border-white/[0.03] text-xs text-white/65">
                  <span className="w-5 h-5 rounded-md bg-gold-500/12 text-gold-400 text-[10px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </GlowCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {BASE_STATS.map((s) => (
              <GlowCard key={s.name} glowColor={s.live ? 'emerald' : 'rose'}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">{s.name}</h3>
                  {s.live ? <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-300 border border-emerald-500/20">LIVE</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/12 text-rose-300 border border-rose-500/20 flex items-center gap-1"><Lock className="w-3 h-3" /> RESEARCH</span>}
                </div>
                {s.live ? (
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="text-white/40">Win rate</div><div className="text-white/80 text-right font-medium">{fmt(s.winRate, 1)}%</div>
                    <div className="text-white/40">Avg R</div><div className="text-white/80 text-right font-medium">{fmt(s.avgR, 3)}R</div>
                    <div className="text-white/40">Profit factor</div><div className="text-white/80 text-right font-medium">{fmt(s.pf)}</div>
                    <div className="text-white/40">Total R</div><div className="text-emerald-400 text-right font-semibold">+{fmt(s.totalR, 1)}R</div>
                    <div className="text-white/40">Max DD</div><div className="text-rose-400 text-right">{s.maxDD}R</div>
                    <div className="text-white/40">Loss streak</div><div className="text-white/60 text-right">{s.maxLossStreak}</div>
                    <div className="text-white/40">Trades / day</div><div className="text-white/60 text-right">{s.trades} / {s.maxPerDay}</div>
                  </div>
                ) : <p className="text-xs text-rose-300/70 italic">{s.note}</p>}
              </GlowCard>
            ))}
          </div>
        </div>
      )}

      {/* FAMILIES */}
      {tab === 'families' && (
        <div className="space-y-4">
          {FAMILIES.map((f) => (
            <GlowCard key={f.id} glowColor={toneBg(f.tone)}>
              <h3 className={`text-lg font-bold ${toneText(f.tone)} mb-1`}>{f.name}</h3>
              <p className="text-sm text-white/70 mb-3">{f.plain}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">What you need</div>
                  <ul className="space-y-1">
                    {f.need.map((n, i) => <li key={i} className="text-xs text-white/60 flex gap-2"><span className="text-gold-400/60">•</span>{n}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">What it looks like</div>
                  <p className="text-xs text-white/60 p-2.5 rounded-lg bg-surface-200/40 border border-white/[0.03]">{f.looksLike}</p>
                  <div className="mt-2 text-xs text-gold-400/80 italic">★ {f.bestRead}</div>
                </div>
              </div>
              <DataTable rows={f.data} />
            </GlowCard>
          ))}
        </div>
      )}

      {/* WINDOWS */}
      {tab === 'windows' && (
        <div className="space-y-4">
          {WINDOWS.map((w) => (
            <GlowCard key={w.n} glowColor="blue">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/12 text-blue-300 text-xs flex items-center justify-center">{w.n}</span>
                  {w.name}
                  <span className="text-blue-400/70 font-mono text-xs">{w.time}</span>
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-200/50 border border-white/[0.06] text-white/50">{w.style}</span>
              </div>
              <p className="text-xs text-white/55 mt-2"><span className="text-white/35">Job:</span> {w.job}</p>
              <p className="text-xs text-white/50 mt-1">{w.notes}</p>
              <div className="text-[11px] text-gold-400/70 mt-1.5">Best-supported: {w.best}</div>
              {w.data.length > 0 && <DataTable rows={w.data} cols={['Model', 'Trades', 'Win%', 'AvgR', 'PF', 'Total R']} />}
              {w.anchorData && <DataTable rows={w.anchorData} cols={['Anchor', 'Trades', 'Win%', 'AvgR', 'PF', 'Total R']} />}
            </GlowCard>
          ))}
        </div>
      )}

      {/* ANCHORS & ROLES */}
      {tab === 'anchors' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlowCard glowColor="gold">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Anchor className="w-4 h-4 text-gold-400" /> Anchor Windows</h3>
            <div className="space-y-1.5">
              {ANCHORS.map(([a, t]) => (
                <div key={a} className="flex justify-between gap-2 p-2 rounded-lg bg-surface-200/40 border border-white/[0.03] text-xs">
                  <span className="text-white/70">{a}</span><span className="text-white/40 font-mono text-right">{t}</span>
                </div>
              ))}
            </div>
          </GlowCard>
          <div className="space-y-4">
            <GlowCard glowColor="purple">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-accent-purple" /> Roles</h3>
              {ROLES.map((r) => (
                <div key={r.role} className="mb-2">
                  <div className="text-xs font-medium text-white/80">{r.role}</div>
                  <div className="text-xs text-white/50">{r.desc}</div>
                </div>
              ))}
            </GlowCard>
            <GlowCard glowColor="rose">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-rose-400" /> Referee Rules</h3>
              {REFEREE_RULES.map(([name, rule, tone]) => (
                <div key={name} className="flex items-start gap-2 mb-1.5 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${tone === 'ok' ? 'bg-emerald-500/12 text-emerald-300' : tone === 'warn' ? 'bg-gold-500/12 text-gold-300' : 'bg-rose-500/12 text-rose-300'}`}>{name}</span>
                  <span className="text-white/55">{rule}</span>
                </div>
              ))}
            </GlowCard>
          </div>
        </div>
      )}

      {/* SCORECARD */}
      {tab === 'scorecard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlowCard glowColor="gold">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Gauge className="w-4 h-4 text-gold-400" /> Variable Quality</h3>
            <div className="space-y-1.5">
              {VARIABLE_QUALITY.map(([v, cls, use, tone]) => (
                <div key={v} className="p-2 rounded-lg bg-surface-200/40 border border-white/[0.03]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/75">{v}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone === 'good' ? 'bg-emerald-500/12 text-emerald-300' : tone === 'bad' ? 'bg-rose-500/12 text-rose-300' : tone === 'warn' ? 'bg-gold-500/12 text-gold-300' : 'bg-blue-500/12 text-blue-300'}`}>{cls}</span>
                  </div>
                  <div className="text-[11px] text-white/45 mt-0.5">{use}</div>
                </div>
              ))}
            </div>
          </GlowCard>
          <div className="space-y-4">
            <GlowCard glowColor="emerald">
              <h3 className="text-sm font-semibold mb-2">Management (time to 1R)</h3>
              {MANAGEMENT.map(([t, action]) => (
                <div key={t} className="flex justify-between gap-2 p-2 rounded-lg bg-surface-200/40 border border-white/[0.03] text-xs mb-1">
                  <span className="text-white/70 font-mono">{t}</span><span className="text-white/55">{action}</span>
                </div>
              ))}
            </GlowCard>
            <GlowCard glowColor="rose">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /> Invalidations — No Trade If</h3>
              <ul className="space-y-1">
                {INVALIDATIONS.map((inv, i) => <li key={i} className="text-xs text-white/55 flex gap-2"><span className="text-rose-400/60">✕</span>{inv}</li>)}
              </ul>
            </GlowCard>
          </div>
        </div>
      )}

      {/* EXAMPLES */}
      {tab === 'examples' && (
        <GlowCard glowColor={ex.failed ? 'rose' : 'emerald'}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setExIdx((i) => Math.max(0, i - 1))} disabled={exIdx === 0} className="p-2 rounded-lg bg-surface-200/50 border border-white/[0.06] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-center">
              <div className="text-lg font-bold">{ex.date}</div>
              <div className={`text-xs ${ex.failed ? 'text-rose-400' : 'text-emerald-400'}`}>{ex.title} · {ex.result}</div>
              <div className="text-[11px] text-white/30">example {exIdx + 1} of {EXAMPLES.length}</div>
            </div>
            <button onClick={() => setExIdx((i) => Math.min(EXAMPLES.length - 1, i + 1))} disabled={exIdx === EXAMPLES.length - 1} className="p-2 rounded-lg bg-surface-200/50 border border-white/[0.06] disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[['Window', ex.window], ['Anchor', ex.anchor], ['Model', ex.model], ['Target', ex.target], ['Referee', ex.referee], ['Confirmation', ex.confirmation], ['Entry', ex.entry], ['Stop', ex.stop], ['Result', ex.result]].map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-surface-200/40 border border-white/[0.03]">
                <div className="text-[10px] uppercase tracking-wider text-white/25">{k}</div>
                <div className="text-white/70">{v}</div>
              </div>
            ))}
          </div>
          <div className={`mt-3 p-2.5 rounded-lg text-xs ${ex.failed ? 'bg-rose-500/[0.06] border border-rose-500/[0.15] text-rose-200/80' : 'bg-surface-200/40 border border-white/[0.04] text-white/65'}`}>
            <span className="text-white/35">Read: </span>{ex.read}
          </div>
        </GlowCard>
      )}

      {/* FLASHCARD DRILL */}
      {tab === 'drill' && (
        <GlowCard glowColor={toneBg(card.tone)}>
          <div className="text-center py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">What family is this? (click to reveal)</div>
            <div onClick={() => setRevealed((r) => !r)} className="cursor-pointer p-6 rounded-2xl bg-surface-200/40 border border-white/[0.06] hover:border-white/15 min-h-[160px] flex flex-col items-center justify-center">
              <p className="text-sm text-white/70 mb-3">{card.looksLike.split('→')[0]}</p>
              {revealed ? (
                <div className="mt-2">
                  <div className={`text-xl font-bold ${toneText(card.tone)}`}>{card.name}</div>
                  <div className="text-xs text-white/50 mt-1">{card.plain}</div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-white/30 text-xs mt-2"><Eye className="w-4 h-4" /> tap to reveal</div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => { setCardIdx((i) => i - 1); setRevealed(false); }} className="px-3 py-1.5 rounded-lg bg-surface-200/50 border border-white/[0.06] text-xs flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
              <button onClick={() => setRevealed((r) => !r)} className="px-3 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs flex items-center gap-1">{revealed ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Reveal</>}</button>
              <button onClick={() => { setCardIdx((i) => i + 1); setRevealed(false); }} className="px-3 py-1.5 rounded-lg bg-surface-200/50 border border-white/[0.06] text-xs flex items-center gap-1">Next <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </GlowCard>
      )}

      {/* MANUAL BACKTESTER */}
      {tab === 'backtest' && <ManualBacktester />}
    </div>
  );
}
