import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  Building2, CheckCircle2, XCircle, AlertTriangle, DollarSign, TrendingDown, Trophy, Info,
} from 'lucide-react';
import GlowCard from '../components/GlowCard';
import MetricCard from '../components/MetricCard';
import { FIRMS, simulate, toDailyR } from '../lib/propSim';

const fmt$ = (n) => `$${Number(n).toLocaleString()}`;

const RESULT_META = {
  passed: { label: 'PASSED ✅', color: 'emerald', icon: Trophy },
  failed_drawdown: { label: 'BLEW ACCOUNT — drawdown', color: 'rose', icon: TrendingDown },
  failed_daily_loss: { label: 'FAILED — daily loss limit', color: 'rose', icon: XCircle },
  in_progress: { label: 'Did not hit target in test window', color: 'gold', icon: Info },
};

// `days` = the v3 day rows passed down from BacktestJournal (have result_R + date)
export default function PropFirmSim({ days = [] }) {
  const [firmKey, setFirmKey] = useState('topstep_50k');
  const [riskPerTrade, setRiskPerTrade] = useState(150); // $ per 1R
  const [startDate, setStartDate] = useState('');

  const firm = FIRMS[firmKey];
  const dailyR = useMemo(() => {
    const all = toDailyR(days);
    return startDate ? all.filter((d) => d.date >= startDate) : all;
  }, [days, startDate]);

  const sim = useMemo(() => simulate(dailyR, firm, riskPerTrade), [dailyR, firm, riskPerTrade]);
  const meta = RESULT_META[sim.result] || RESULT_META.in_progress;
  const Icon = meta.icon;

  // suggested max risk to survive worst historical loss streak within daily limit
  return (
    <div className="space-y-4">
      <GlowCard glowColor="blue">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-white/65 leading-relaxed">
            <span className="text-blue-300 font-semibold">Prop Firm Simulator.</span> Runs your backtested R-results through real firm rules (trailing drawdown, daily loss, profit target, consistency) to answer: <em>would I pass, when, and would I ever blow it?</em>
          </p>
        </div>
      </GlowCard>

      {/* Controls */}
      <GlowCard glowColor="gold">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">Prop firm</div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(FIRMS).map(([k, f]) => (
                <button key={k} onClick={() => setFirmKey(k)}
                  className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${firmKey === k ? 'bg-gold-500/12 text-gold-300 border-gold-500/25' : 'bg-surface-200/40 text-white/50 border-white/[0.06] hover:text-white/70'}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">Risk per trade (1R in $)</div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-white/30" />
              <input type="number" step="25" value={riskPerTrade} onChange={(e) => setRiskPerTrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[50, 100, 150, 200, 300].map((v) => (
                <button key={v} onClick={() => setRiskPerTrade(v)} className={`px-2 py-1 rounded-md text-[11px] border ${riskPerTrade === v ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-surface-200/40 text-white/45 border-white/[0.06]'}`}>${v}</button>
              ))}
            </div>
            <div className="text-[10px] text-white/30 mt-2">A +3R win = {fmt$(3 * riskPerTrade)}. A -1R loss = -{fmt$(riskPerTrade)}.</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">Start from date (optional)</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg bg-surface-200/60 border border-white/[0.06] text-sm text-white" />
            <div className="mt-3 p-2.5 rounded-lg bg-surface-200/40 border border-white/[0.03] text-[11px] text-white/45 space-y-0.5">
              <div>Target: <span className="text-emerald-400">{fmt$(firm.profitTarget)}</span></div>
              <div>Trailing DD: <span className="text-rose-400">{fmt$(firm.maxTrailingDD)}</span> ({firm.ddType})</div>
              <div>Daily loss: <span className="text-rose-400">{fmt$(firm.dailyLossLimit)}</span></div>
              <div>Consistency: {firm.consistencyPct}% · Min days: {firm.minDays}</div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-white/30 mt-2 flex items-center gap-1"><Info className="w-3 h-3" /> {firm.note}</p>
      </GlowCard>

      {/* Result banner */}
      <GlowCard glowColor={meta.color}>
        <div className="flex items-center gap-3">
          <Icon className={`w-7 h-7 text-${meta.color}-400`} strokeWidth={1.5} />
          <div>
            <div className={`text-lg font-bold text-${meta.color}-400`}>{meta.label}</div>
            <div className="text-xs text-white/50">
              {sim.result === 'passed' && `Hit ${fmt$(firm.profitTarget)} target on ${sim.passDay} after ${sim.tradingDays} trading days.`}
              {(sim.result === 'failed_drawdown' || sim.result === 'failed_daily_loss') && `Account breached on ${sim.breachDay} (day ${sim.tradingDays}).`}
              {sim.result === 'in_progress' && `Ended at ${fmt$(sim.finalProfit)} profit over ${sim.tradingDays} days — didn't reach target in this window.`}
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Final Balance" value={fmt$(sim.finalBalance)} subtitle={`from ${fmt$(firm.accountSize)}`} icon={DollarSign} color={sim.finalProfit >= 0 ? 'emerald' : 'rose'} glow />
        <MetricCard label="Net Profit" value={fmt$(sim.finalProfit)} subtitle="self-backtested" icon={Trophy} color={sim.finalProfit >= 0 ? 'emerald' : 'rose'} glow />
        <MetricCard label="Best Day" value={fmt$(sim.bestDayProfit)} subtitle={`cap ${fmt$(sim.consistencyCap)}`} icon={TrendingDown} color={sim.consistencyOK ? 'emerald' : 'gold'} glow />
        <MetricCard label="Worst Day" value={fmt$(sim.worstDayLoss)} subtitle={`limit -${fmt$(firm.dailyLossLimit)}`} icon={AlertTriangle} color="rose" glow />
      </div>

      {/* Equity vs floor chart */}
      <GlowCard glowColor="blue">
        <h3 className="text-sm font-semibold mb-3">Account Balance vs Drawdown Floor</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={sim.curve}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff40' }} minTickGap={50} />
            <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine y={sim.targetBalance} stroke="#34d399" strokeDasharray="4 4" label={{ value: 'Target', fill: '#34d399', fontSize: 10 }} />
            <ReferenceLine y={firm.accountSize} stroke="rgba(255,255,255,0.2)" />
            <Line type="monotone" dataKey="balance" stroke="#5b9bd5" strokeWidth={2} dot={false} isAnimationActive={false} name="Balance" />
            <Line type="monotone" dataKey="floor" stroke="#fb7185" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} name="DD Floor" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-white/40">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Account balance</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-400 inline-block" /> Drawdown floor (don't touch)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Profit target</span>
        </div>
      </GlowCard>
    </div>
  );
}
