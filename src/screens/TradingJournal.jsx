import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NotebookPen, CheckCircle2, XCircle, Lightbulb, Brain, Save, Plus,
  CalendarDays, TrendingUp, Flame, ShieldCheck, AlertTriangle, Trash2, Target,
  Trophy, Zap, ChevronLeft, ChevronRight,
} from 'lucide-react';
import GlowCard from '../components/GlowCard';
import MetricCard from '../components/MetricCard';
import {
  WEEKDAY_LABELS, monthGrid, weekStartKey, weekScore, monthScore, currentStreak, ymd,
} from '../lib/gamify';

const STORE_KEY = 'lifeos_trading_journal';
const loadEntries = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; } };
const saveEntries = (list) => localStorage.setItem(STORE_KEY, JSON.stringify(list));

// --- model-driven option sets (tap, don't type) -----------------------------
const ASSETS = ['NQ', 'ES', 'YM'];
const SIDES = ['BUY', 'SELL'];
const FAMILIES = ['Reversal BUY', 'Reversal SELL', 'Continuation BUY', 'Continuation SELL'];
const WINDOWS = ['Premarket', 'Open 9:30-9:45', '9:45 Primary', '10:15 Recheck', 'Late 10:45+'];
const ANCHORS = ['Overnight', 'Premarket', 'ORM', 'Rolling 15m', 'Rolling 30m', 'Final 90m'];
const REFEREES = ['Clean', 'Dirty', 'Invalid'];
const CONFIRMS = ['IFVG', 'MSS', 'IFVG+MSS'];
const SPEEDS = ['Fast 0-2m', 'Mid 3-5m', 'Slow 5m+', 'No 1R'];
const OUTCOMES = [
  ['taken', 'Taken'],
  ['skipped_not_best', 'Skipped — not best card'],
  ['skipped_invalidated', 'Skipped — invalidated'],
  ['blocked_overtrading', 'Blocked — avoid overtrading'],
];
const EMOTIONS = [
  ['disciplined', '😌 Disciplined', 'emerald'],
  ['neutral', '😐 Neutral', 'blue'],
  ['fomo', '😰 FOMO', 'gold'],
  ['revenge', '😠 Revenge', 'rose'],
  ['fearful', '😨 Fearful', 'purple'],
];

const RULE_CHECKS = [
  'Waited for the full stack (not just the sweep)',
  'Referee had no conflict',
  'Required MSS/IFVG before entry',
  'Stop on the MSS candle (not Q4/large)',
  'Respected window rules (no random open/late)',
  'Managed by 1R speed (held only if fast)',
  'Did NOT overtrade (max-per-day respected)',
];

const blankEntry = (date) => ({
  id: `tj-${Date.now()}`,
  date,
  tradedToday: true,
  // trade fields (quick-tap)
  asset: '', side: '', family: '', window: '', entryTime: '',
  anchor: '', sweptBy: '', refusedBy: '', referee: '', confirm: '', speed: '',
  outcome: 'taken', pnlR: '',
  protectedAfter1R: false,
  // reflection (only what's worth typing)
  didWell: '', didWrong: '', lesson: '',
  emotion: 'neutral', followedModel: null,
  ruleChecks: {},
  weeklyReview: false,
});

// reusable tap-chip row
function Chips({ label, options, value, onChange, tone }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const val = Array.isArray(opt) ? opt[0] : opt;
          const lab = Array.isArray(opt) ? opt[1] : opt;
          const active = value === val;
          const activeCls = tone === 'buy' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : tone === 'sell' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : 'bg-gold-500/12 text-gold-300 border-gold-500/25';
          return (
            <button key={val} onClick={() => onChange(active ? '' : val)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${active ? activeCls : 'bg-surface-200/40 text-white/45 border-white/[0.06] hover:text-white/70'}`}>
              {lab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ icon: Icon, color, label, value, onChange, rows = 2, placeholder = '…' }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-white/50 flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 text-${color}-400`} strokeWidth={1.5} /> {label}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 resize-none"
        placeholder={placeholder} />
    </div>
  );
}

export default function TradingJournal() {
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState(loadEntries);
  const [editing, setEditing] = useState(() => loadEntries().find((e) => e.date === today) || blankEntry(today));
  const [savedFlash, setSavedFlash] = useState(false);

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));
  const toggleRule = (i) => setEditing((e) => ({ ...e, ruleChecks: { ...e.ruleChecks, [i]: !e.ruleChecks?.[i] } }));

  const persist = () => {
    const others = entries.filter((e) => e.id !== editing.id && e.date !== editing.date);
    const next = [...others, editing].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(next); saveEntries(next);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200);
  };
  const remove = (id) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next); saveEntries(next);
    if (editing.id === id) setEditing(blankEntry(today));
  };
  const newEntry = () => setEditing(blankEntry(today));
  const editEntry = (e) => setEditing({ ...blankEntry(e.date), ...e, ruleChecks: e.ruleChecks || {} });

  const stats = useMemo(() => {
    const withR = entries.filter((e) => e.tradedToday && e.pnlR !== '' && !isNaN(parseFloat(e.pnlR)));
    const totalR = withR.reduce((s, e) => s + parseFloat(e.pnlR), 0);
    const wins = withR.filter((e) => parseFloat(e.pnlR) > 0).length;
    const followed = entries.filter((e) => e.followedModel === true).length;
    const broke = entries.filter((e) => e.followedModel === false).length;
    return {
      days: entries.length,
      totalR: totalR.toFixed(1),
      winPct: withR.length ? Math.round((wins / withR.length) * 100) : 0,
      discipline: (followed + broke) ? Math.round((followed / (followed + broke)) * 100) : 0,
    };
  }, [entries]);

  const ruleScore = RULE_CHECKS.filter((_, i) => editing.ruleChecks?.[i]).length;
  const sideTone = editing.side === 'BUY' ? 'buy' : editing.side === 'SELL' ? 'sell' : 'gold';

  // --- gamification / calendar state ---
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const loggedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const reviewDates = useMemo(() => new Set(entries.filter((e) => e.weeklyReview).map((e) => e.date)), [entries]);
  const grid = useMemo(() => monthGrid(calY, calM), [calY, calM]);
  const thisWeek = weekScore(entries, weekStartKey(ymd(now)));
  const thisMonth = monthScore(entries, calY, calM);
  const streak = useMemo(() => currentStreak(entries, now), [entries]);
  const monthName = new Date(calY, calM, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const prevMonth = () => { const d = new Date(calY, calM - 1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); };
  const nextMonth = () => { const d = new Date(calY, calM + 1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <NotebookPen className="w-8 h-8 text-gold-400" strokeWidth={1.5} /> Trading Journal
          </h1>
          <p className="text-white/40 mt-1 text-sm">Tap the trade details, type only what matters. Fast but complete.</p>
        </div>
        <button onClick={newEntry} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 text-sm font-medium hover:bg-gold-500/15">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Journaled Days" value={stats.days} subtitle="entries" icon={CalendarDays} color="blue" glow />
        <MetricCard label="Total R (logged)" value={stats.totalR} subtitle="self-reported" icon={TrendingUp} color={parseFloat(stats.totalR) >= 0 ? 'emerald' : 'rose'} glow />
        <MetricCard label="Win %" value={`${stats.winPct}%`} subtitle="of logged days" icon={Flame} color="gold" glow />
        <MetricCard label="Discipline" value={`${stats.discipline}%`} subtitle="followed the model" icon={ShieldCheck} color="purple" glow />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Header: date + traded toggle + save */}
          <GlowCard glowColor="gold">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <input type="date" value={editing.date} onChange={(e) => set('date', e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
              <div className="flex items-center gap-1.5">
                <button onClick={() => set('tradedToday', true)} className={`px-3 py-1.5 rounded-lg text-xs border ${editing.tradedToday ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>Traded</button>
                <button onClick={() => set('tradedToday', false)} className={`px-3 py-1.5 rounded-lg text-xs border ${!editing.tradedToday ? 'bg-blue-500/12 text-blue-300 border-blue-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>No trade</button>
                <button onClick={() => set('weeklyReview', !editing.weeklyReview)} title="Mark this entry as your weekly review (counts toward 6/6)" className={`px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1 ${editing.weeklyReview ? 'bg-gold-500/12 text-gold-300 border-gold-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}><Trophy className="w-3 h-3" /> Weekly review</button>
              </div>
              <button onClick={persist} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15">
                <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Saved' : 'Save'}
              </button>
            </div>

            {/* THE TRADE — collapses on no-trade days */}
            <AnimatePresence initial={false}>
              {editing.tradedToday && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-gold-400/80 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> The Trade</div>

                    {/* asset + side, big chips */}
                    <div className="grid grid-cols-2 gap-3">
                      <Chips label="Asset" options={ASSETS} value={editing.asset} onChange={(v) => set('asset', v)} />
                      <Chips label="Side" options={SIDES} value={editing.side} onChange={(v) => set('side', v)} tone={editing.side === 'BUY' ? 'buy' : editing.side === 'SELL' ? 'sell' : 'gold'} />
                    </div>

                    <Chips label="Model family" options={FAMILIES} value={editing.family} onChange={(v) => set('family', v)} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Chips label="Window" options={WINDOWS} value={editing.window} onChange={(v) => set('window', v)} />
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Entry time</div>
                        <input type="time" value={editing.entryTime} onChange={(e) => set('entryTime', e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-surface-200/60 border border-white/[0.06] text-xs text-white" />
                      </div>
                    </div>

                    <Chips label="Sweep anchor" options={ANCHORS} value={editing.anchor} onChange={(v) => set('anchor', v)} />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Chips label="Who swept" options={ASSETS} value={editing.sweptBy} onChange={(v) => set('sweptBy', v)} />
                      <Chips label="Who refused (target)" options={ASSETS} value={editing.refusedBy} onChange={(v) => set('refusedBy', v)} />
                      <Chips label="Referee" options={REFEREES} value={editing.referee} onChange={(v) => set('referee', v)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Chips label="Confirmation" options={CONFIRMS} value={editing.confirm} onChange={(v) => set('confirm', v)} />
                      <Chips label="1R speed" options={SPEEDS} value={editing.speed} onChange={(v) => set('speed', v)} />
                    </div>

                    <Chips label="Outcome" options={OUTCOMES} value={editing.outcome} onChange={(v) => set('outcome', v)} />

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-white/40">Result (R):</span>
                        <input type="number" step="0.25" value={editing.pnlR} onChange={(e) => set('pnlR', e.target.value)} placeholder="3 / -1"
                          className="w-20 px-2 py-1 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                        <input type="checkbox" checked={!!editing.protectedAfter1R} onChange={(e) => set('protectedAfter1R', e.target.checked)} /> Protected after 1R
                      </label>
                    </div>
                  </div>
                  <div className="my-4 border-t border-white/[0.06]" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* REFLECTION — always shown, only the words worth writing */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-white/40">Followed the model?</span>
                <button onClick={() => set('followedModel', true)} className={`px-3 py-1 rounded-lg text-xs border ${editing.followedModel === true ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>Yes</button>
                <button onClick={() => set('followedModel', false)} className={`px-3 py-1 rounded-lg text-xs border ${editing.followedModel === false ? 'bg-rose-500/12 text-rose-300 border-rose-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>No</button>
                <div className="flex flex-wrap gap-1.5 ml-auto">
                  {EMOTIONS.map(([id, label]) => (
                    <button key={id} onClick={() => set('emotion', id)} className={`px-2 py-1 rounded-lg text-[11px] border ${editing.emotion === id ? 'bg-gold-500/12 text-gold-300 border-gold-500/25' : 'bg-surface-200/40 text-white/45 border-white/[0.06]'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <Field icon={CheckCircle2} color="emerald" label="What did I do WELL?" value={editing.didWell} onChange={(v) => set('didWell', v)} placeholder="optional — one line is fine" />
              <Field icon={XCircle} color="rose" label="What did I do WRONG?" value={editing.didWrong} onChange={(v) => set('didWrong', v)} placeholder="optional — one line is fine" />
              <Field icon={Lightbulb} color="gold" label="Lesson / fix for next time" value={editing.lesson} onChange={(v) => set('lesson', v)} rows={1} placeholder="optional" />
            </div>
          </GlowCard>
        </div>

        {/* Calendar + gamification + rule adherence + history */}
        <div className="space-y-4">
          {/* GAMIFIED GOALS */}
          <GlowCard glowColor="gold">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-gold-400" /> This Week</h3>
              <div className="flex items-center gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-white/60">{streak} day streak</span>
              </div>
            </div>
            {/* 5 daily pips + review pip = 6/6 */}
            <div className="flex items-center gap-1.5 mb-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`flex-1 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${i < thisWeek.daily ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-surface-200/40 text-white/25 border-white/[0.06]'}`}>
                  {i < thisWeek.daily ? '✓' : i + 1}
                </div>
              ))}
              <div className={`w-9 h-7 rounded-lg flex items-center justify-center border ${thisWeek.review ? 'bg-gold-500/20 text-gold-300 border-gold-500/30' : 'bg-surface-200/40 text-white/25 border-white/[0.06]'}`}>
                <Trophy className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/45">{thisWeek.daily}/5 daily + {thisWeek.review}/1 review</span>
              <span className={`font-bold ${thisWeek.total === 6 ? 'text-emerald-400' : 'text-gold-400'}`}>{thisWeek.total}/6 {thisWeek.total === 6 ? '🔥' : ''}</span>
            </div>
            {/* monthly */}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-white/45 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-blue-400" /> {monthName}</span>
                <span className={`font-bold ${thisMonth.pct >= 100 ? 'text-emerald-400' : 'text-white/70'}`}>{thisMonth.logged}/{thisMonth.tradingDays} days · {thisMonth.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-200/50 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold-500 to-emerald-500" style={{ width: `${Math.min(100, thisMonth.pct)}%` }} />
              </div>
            </div>
          </GlowCard>

          {/* CALENDAR HEATMAP */}
          <GlowCard glowColor="blue">
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/[0.05]"><ChevronLeft className="w-4 h-4 text-white/50" /></button>
              <span className="text-sm font-semibold">{monthName}</span>
              <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/[0.05]"><ChevronRight className="w-4 h-4 text-white/50" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((d) => <div key={d} className="text-center text-[9px] text-white/25 uppercase">{d[0]}</div>)}
            </div>
            <div className="space-y-1">
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((ds, di) => {
                    if (!ds) return <div key={di} className="aspect-square" />;
                    const logged = loggedDates.has(ds);
                    const review = reviewDates.has(ds);
                    const dayNum = parseInt(ds.slice(-2), 10);
                    const isToday = ds === ymd(now);
                    return (
                      <button key={di} onClick={() => { const ex = entries.find((e) => e.date === ds); ex ? editEntry(ex) : setEditing({ ...blankEntry(ds) }); }}
                        title={ds + (logged ? ' · logged' : '')}
                        className={`aspect-square rounded-md text-[9px] flex items-center justify-center border transition-all
                          ${review ? 'bg-gold-500/25 text-gold-200 border-gold-500/40'
                            : logged ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/30'
                            : 'bg-surface-200/30 text-white/25 border-white/[0.04] hover:border-white/15'}
                          ${isToday ? 'ring-1 ring-gold-400/60' : ''}`}>
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-white/35">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/40 inline-block" /> logged</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gold-500/40 inline-block" /> weekly review</span>
            </div>
          </GlowCard>

          <GlowCard glowColor="emerald">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Rule Adherence</h3>
              <span className={`text-xs font-bold ${ruleScore === RULE_CHECKS.length ? 'text-emerald-400' : ruleScore >= 4 ? 'text-gold-400' : 'text-rose-400'}`}>{ruleScore}/{RULE_CHECKS.length}</span>
            </div>
            <div className="space-y-1">
              {RULE_CHECKS.map((r, i) => (
                <label key={i} className="flex items-start gap-2 text-xs text-white/60 cursor-pointer p-1.5 rounded-lg hover:bg-white/[0.02]">
                  <input type="checkbox" checked={!!editing.ruleChecks?.[i]} onChange={() => toggleRule(i)} className="mt-0.5" /> {r}
                </label>
              ))}
            </div>
          </GlowCard>

          <GlowCard glowColor="blue">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-400" /> History</h3>
            {entries.length === 0 && <p className="text-xs text-white/30 italic">No entries yet. Save your first day.</p>}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto scrollable">
              {entries.map((e) => (
                <div key={e.id} onClick={() => editEntry(e)} className="flex items-center gap-2 p-2 rounded-lg bg-surface-200/40 border border-white/[0.03] hover:border-white/15 cursor-pointer">
                  <span className="text-xs text-white/70 font-mono">{e.date}</span>
                  {e.tradedToday && e.asset && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${e.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>{e.asset} {e.side}</span>
                  )}
                  {e.pnlR !== '' && <span className={`text-xs font-semibold ${parseFloat(e.pnlR) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{parseFloat(e.pnlR) >= 0 ? '+' : ''}{e.pnlR}R</span>}
                  {e.followedModel === false && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                  {!e.tradedToday && <span className="text-[10px] text-blue-300/60">no trade</span>}
                  <button onClick={(ev) => { ev.stopPropagation(); remove(e.id); }} className="ml-auto text-white/20 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
