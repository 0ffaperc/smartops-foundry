import React, { useMemo, useState } from 'react';
import {
  FlaskConical, Plus, Save, Trash2, TrendingUp, Target, Filter, X,
} from 'lucide-react';
import GlowCard from '../components/GlowCard';
import MetricCard from '../components/MetricCard';

// Manual model backtester: log trades YOU replay on TradingView, like a backtest journal.
const STORE_KEY = 'lifeos_manual_backtest';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; } };
const save = (l) => localStorage.setItem(STORE_KEY, JSON.stringify(l));

const ASSETS = ['NQ', 'ES', 'YM'];
const SIDES = ['BUY', 'SELL'];
const FAMILIES = ['Reversal BUY', 'Reversal SELL', 'Continuation BUY', 'Continuation SELL'];
const WINDOWS = ['Premarket', 'Open 9:30-9:45', '9:45 Primary', '10:15 Recheck', 'Late 10:45+'];
const ANCHORS = ['Overnight', 'Premarket', 'ORM', 'Rolling 15m', 'Rolling 30m', 'Final 90m'];
const REFEREES = ['Clean', 'Dirty', 'Invalid'];
const CONFIRMS = ['IFVG', 'MSS', 'IFVG+MSS'];
const SPEEDS = ['Fast 0-2m', 'Mid 3-5m', 'Slow 5m+', 'No 1R'];

const blank = () => ({
  id: `bt-${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  asset: '', side: '', family: '', window: '', anchor: '',
  sweptBy: '', refusedBy: '', referee: '', confirm: '', speed: '',
  entryTime: '', resultR: '', valid: true,
  whySwept: '', whyRefused: '', refereeAction: '', lesson: '',
});

function Chips({ label, options, value, onChange, tone }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          const cls = tone === 'buy' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : tone === 'sell' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : 'bg-gold-500/12 text-gold-300 border-gold-500/25';
          return (
            <button key={opt} onClick={() => onChange(active ? '' : opt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${active ? cls : 'bg-surface-200/40 text-white/45 border-white/[0.06] hover:text-white/70'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ManualBacktester() {
  const [trades, setTrades] = useState(load);
  const [editing, setEditing] = useState(blank());
  const [savedFlash, setSavedFlash] = useState(false);
  const [filterFamily, setFilterFamily] = useState('');

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  const persist = () => {
    if (!editing.asset || !editing.side) { return; }
    const others = trades.filter((t) => t.id !== editing.id);
    const next = [editing, ...others].sort((a, b) => b.date.localeCompare(a.date));
    setTrades(next); save(next);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200);
    setEditing(blank());
  };
  const remove = (id) => { const next = trades.filter((t) => t.id !== id); setTrades(next); save(next); };
  const edit = (t) => setEditing({ ...blank(), ...t });

  const filtered = filterFamily ? trades.filter((t) => t.family === filterFamily) : trades;

  const stats = useMemo(() => {
    const withR = filtered.filter((t) => t.resultR !== '' && !isNaN(parseFloat(t.resultR)));
    const totalR = withR.reduce((s, t) => s + parseFloat(t.resultR), 0);
    const wins = withR.filter((t) => parseFloat(t.resultR) > 0).length;
    return {
      count: filtered.length,
      totalR: totalR.toFixed(1),
      winPct: withR.length ? Math.round((wins / withR.length) * 100) : 0,
      avgR: withR.length ? (totalR / withR.length).toFixed(2) : '0',
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <GlowCard glowColor="purple">
        <div className="flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-accent-purple mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-white/65 leading-relaxed">
            <span className="text-accent-purple font-semibold">Manual Backtester.</span> Replay the model on TradingView, then log each trade here. Build your own proof, one chart at a time. Tap the details, type only the lessons.
          </p>
        </div>
      </GlowCard>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Logged Trades" value={stats.count} subtitle={filterFamily || 'all families'} icon={FlaskConical} color="purple" glow />
        <MetricCard label="Total R" value={stats.totalR} subtitle="self-backtested" icon={TrendingUp} color={parseFloat(stats.totalR) >= 0 ? 'emerald' : 'rose'} glow />
        <MetricCard label="Win %" value={`${stats.winPct}%`} subtitle="of logged" icon={Target} color="gold" glow />
        <MetricCard label="Avg R" value={stats.avgR} subtitle="per trade" icon={TrendingUp} color="blue" glow />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* editor */}
        <div className="lg:col-span-2">
          <GlowCard glowColor="gold">
            <div className="flex items-center justify-between mb-3">
              <input type="date" value={editing.date} onChange={(e) => set('date', e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
              <div className="flex items-center gap-1.5">
                <button onClick={() => set('valid', true)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${editing.valid ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>Valid setup</button>
                <button onClick={() => set('valid', false)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${!editing.valid ? 'bg-rose-500/12 text-rose-300 border-rose-500/25' : 'bg-surface-200/40 text-white/40 border-white/[0.06]'}`}>Invalidated</button>
                <button onClick={persist} disabled={!editing.asset || !editing.side} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 disabled:opacity-40">
                  <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Logged' : 'Log Trade'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/40">Result (R):</span>
                <input type="number" step="0.25" value={editing.resultR} onChange={(e) => set('resultR', e.target.value)} placeholder="3 / -1"
                  className="w-20 px-2 py-1 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
              </div>

              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[['whySwept', 'Which high/low was swept?'], ['whyRefused', 'Why did the target refuse?'], ['refereeAction', 'What did the referee do?'], ['lesson', 'Lesson to remember']].map(([k, label]) => (
                  <div key={k}>
                    <label className="text-[10px] uppercase tracking-wider text-white/25">{label}</label>
                    <textarea value={editing[k]} onChange={(e) => set(k, e.target.value)} rows={1}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.06] text-xs text-white placeholder:text-white/15 focus:border-gold-500/30 resize-none" placeholder="optional" />
                  </div>
                ))}
              </div>
            </div>
          </GlowCard>
        </div>

        {/* log list */}
        <div>
          <GlowCard glowColor="blue">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Backtest Log</h3>
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-white/30" />
                <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}
                  className="text-[11px] bg-surface-200/60 border border-white/[0.06] rounded-lg px-1.5 py-1 text-white/60">
                  <option value="">All</option>
                  {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            {filtered.length === 0 && <p className="text-xs text-white/30 italic">No backtested trades yet. Log your first replay.</p>}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto scrollable">
              {filtered.map((t) => (
                <div key={t.id} onClick={() => edit(t)} className="p-2 rounded-lg bg-surface-200/40 border border-white/[0.03] hover:border-white/15 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/60 font-mono">{t.date}</span>
                    {t.asset && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>{t.asset} {t.side}</span>}
                    {t.resultR !== '' && <span className={`text-xs font-semibold ${parseFloat(t.resultR) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{parseFloat(t.resultR) >= 0 ? '+' : ''}{t.resultR}R</span>}
                    <button onClick={(ev) => { ev.stopPropagation(); remove(t.id); }} className="ml-auto text-white/20 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {t.family && <div className="text-[10px] text-white/35 mt-0.5">{t.family} · {t.window} · {t.anchor}</div>}
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
