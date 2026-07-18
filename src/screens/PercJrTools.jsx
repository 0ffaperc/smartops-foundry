import { useState } from 'react';
import {
  Sparkles, ShieldCheck, ClipboardCheck, FlaskConical,
  Sun, Youtube, Loader2, AlertTriangle, Copy, Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Perc Jr. Tools — 5 GLM 5.2 / Kimi-powered helpers that run over your real
// LifeOS data. Each tool sends a purpose-built prompt to the orchestrator
// backend (http://localhost:8787). Brain = GLM 5.2 (coach mode), Hands =
// Kimi K2.7 Code (site mode, used by the code auditor + variant generator).
// ---------------------------------------------------------------------------

const BACKEND = 'http://localhost:8787/api/orchestrator';

// Pull whatever trading data we have saved locally so the tools have real context.
function readTradingData() {
  const safe = (k) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
  };
  return {
    tradingJournal: safe('lifeos.tradingJournal') || safe('tradingJournal') || [],
    manualBacktest: safe('lifeos.manualBacktest') || safe('manualBacktest') || [],
    // System V3 headline stats (faithful, do not change)
    v3: {
      oneBest: { trades: 567, days: 567, winPct: 56.97, avgR: 1.115, pf: 3.59, maxDD: -7, maxLossStreak: 7, totalR: 631.98 },
      twoMax: { trades: 746, days: 567, winPct: 56.84, avgR: 1.132, pf: 3.62, maxDD: -7, maxLossStreak: 6, totalR: 844.21 },
      span: '2023-01-03 to 2026-06-04',
      families: ['Reversal BUY (cleanest)', 'Reversal SELL (10:15 recheck weakest, 48.57%)', 'Continuation BUY', 'Continuation SELL'],
    },
  };
}

const TOOLS = [
  {
    id: 'auditor',
    title: 'Backtest Code Auditor',
    icon: ShieldCheck,
    color: 'text-rose-400',
    blurb: 'Paste backtest code (Python/JS). Kimi K2.7 Code scans it for look-ahead bias and other leaks.',
    mode: 'site',
    needsInput: true,
    inputLabel: 'Paste your backtest code here',
    placeholder: '# paste your strategy / backtest code...',
    buildPrompt: (code) => `You are a quantitative code reviewer. Audit the backtest code below ONLY for correctness issues that would invalidate results — especially LOOK-AHEAD BIAS. Check specifically for:
1. Using the same candle's close/high/low to BOTH decide entry AND enter (you only know a candle's full range after it closes).
2. Confirming MSS/IFVG with a candle that also triggers the entry.
3. Anchor highs/lows or sweeps computed over a window that extends past the decision time.
4. "1R hit fast" / MFE / MAE measured using future bars that bleed into the entry decision.
5. Resampling / rolling windows that leak future data.
6. Survivorship or fill assumptions that are unrealistic.

For each issue: quote the exact line, explain the leak in one sentence, and give the corrected line. End with a one-line verdict: SAFE or HAS LEAKS.

CODE:
\`\`\`
${code}
\`\`\``,
  },
  {
    id: 'journal',
    title: 'Weekly Journal Reviewer',
    icon: ClipboardCheck,
    color: 'text-amber-400',
    blurb: 'GLM 5.2 reads your Trading Journal entries and flags recurring rule-breaks and patterns.',
    mode: 'coach',
    needsInput: false,
    buildPrompt: () => {
      const { tradingJournal } = readTradingData();
      const recent = tradingJournal.slice(-15);
      return `You are Perc Jr., Sir Perc's trading coach. Review his recent Trading Journal entries below. Your job:
1. Identify the TOP 3 recurring mistakes or rule-breaks (be specific — entry time discipline, chasing sweeps, oversizing, skipping referee check, etc.).
2. Note 1-2 things he's doing WELL so he keeps them.
3. Give ONE single highest-leverage focus for next week.
Be direct and concrete. No flattery. If there are too few entries to judge, say so plainly.

Core rule he must follow: "Do not trade the sweep. Trade the asset that refuses the sweep, confirms with MSS/IFVG, and proves itself with fast 1R."

RECENT JOURNAL ENTRIES (${recent.length}):
${JSON.stringify(recent, null, 2)}`;
    },
  },
  {
    id: 'variant',
    title: 'Strategy Variant Generator',
    icon: FlaskConical,
    color: 'text-cyan-400',
    blurb: 'Describe a "what if" (e.g. "only 9:45–10:15 reversals"). Kimi drafts leak-free test code.',
    mode: 'site',
    needsInput: true,
    inputLabel: 'Describe the variant to test',
    placeholder: 'e.g. What if I only took Reversal BUY in the 9:45-10:15 window?',
    buildPrompt: (idea) => `You are a quant developer. Sir Perc trades System V3 (a discretionary AM model: sweep refusal + MSS/IFVG confirmation + referee no-conflict + fast 1R management; 4 families: Reversal BUY/SELL, Continuation BUY/SELL; windows: 9:30-9:45 open, 9:45-10:15 primary, 10:15-11:00 recheck).

He wants to test this variant: "${idea}"

Write a SHORT, clean, LEAK-FREE Python backtest snippet (using a pandas DataFrame of OHLC bars indexed by time) that isolates and tests this variant. CRITICAL: it must be event-safe — only use information available at or before the decision bar's CLOSE. Add a comment on every line that could otherwise leak future data, showing how you avoided it. Keep it under ~40 lines. Do NOT invent new trading rules — only filter/measure the existing model as described.`,
  },
  {
    id: 'brief',
    title: 'Daily Morning Brief',
    icon: Sun,
    color: 'text-yellow-400',
    blurb: 'GLM 5.2 turns today\u2019s goals, tasks and habits into a tight command brief.',
    mode: 'coach',
    needsInput: false,
    buildPrompt: () => 'Give me my daily command brief: the single highest-leverage action first, a brief reason, then my next 3-7 concrete actions as TASK: lines. Tight and direct.',
  },
  {
    id: 'youtube',
    title: 'YouTube Automation',
    icon: Youtube,
    color: 'text-red-400',
    blurb: 'GLM 5.2 drafts titles, hooks, outlines and metadata for a video topic.',
    mode: 'coach',
    needsInput: true,
    inputLabel: 'Video topic / rough idea',
    placeholder: 'e.g. How I backtested my NQ model over 567 days',
    buildPrompt: (topic) => `You are a YouTube strategist. For the video idea: "${topic}" produce:
1. Five high-CTR title options (curiosity + clarity, no clickbait lies).
2. A 15-second hook script (spoken).
3. A tight outline (6-9 beats).
4. Description + 10 tags + 1 thumbnail concept (text overlay + visual).
Keep it punchy and ready to use.`,
  },
];

function ToolCard({ tool, onRun }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const Icon = tool.icon;

  async function run() {
    if (tool.needsInput && !input.trim()) {
      setError('Add some input first.');
      return;
    }
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const reply = await onRun(tool, input);
      setOutput(reply);
    } catch (e) {
      setError(e.message || 'Failed. Is the backend running on :8787?');
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${tool.color}`}><Icon size={22} /></div>
        <div className="flex-1">
          <h3 className="text-slate-100 font-semibold">{tool.title}</h3>
          <p className="text-slate-400 text-sm mt-0.5">{tool.blurb}</p>
        </div>
      </div>

      {tool.needsInput && (
        <div>
          <label className="text-xs text-slate-500">{tool.inputLabel}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tool.placeholder}
            rows={tool.id === 'auditor' || tool.id === 'variant' ? 6 : 3}
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-y"
          />
        </div>
      )}

      <button
        onClick={run}
        disabled={loading}
        className="self-start inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? 'Thinking…' : 'Run'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {output && (
        <div className="relative bg-slate-900 border border-slate-700 rounded-lg p-3 mt-1">
          <button
            onClick={copy}
            className="absolute top-2 right-2 text-slate-500 hover:text-slate-200"
            title="Copy"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
          <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans pr-6">{output}</pre>
        </div>
      )}
    </div>
  );
}

export default function PercJrTools({ goals = [], tasks = [], habits = [], habitLogs = [], reviews = [], today }) {
  async function runTool(tool, input) {
    const userMessage = tool.buildPrompt(input);
    const res = await fetch(BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        mode: tool.mode,
        today: today || new Date().toISOString().slice(0, 10),
        appState: { goals, tasks, habits, habitLogs, reviews },
      }),
    });
    if (!res.ok) throw new Error(`Backend ${res.status} — is server.mjs running on :8787?`);
    const data = await res.json();
    if (!data?.reply) throw new Error('Empty reply from backend.');
    return data.reply;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="text-indigo-400" size={26} />
        <h1 className="text-2xl font-bold text-slate-100">Perc Jr. Tools</h1>
      </div>
      <p className="text-slate-400 mb-2">
        Five AI helpers running on your real LifeOS data.
      </p>
      <div className="inline-flex items-center gap-2 text-xs text-slate-500 mb-6 bg-slate-800/60 border border-slate-700 rounded-full px-3 py-1">
        <span className="text-indigo-400">Brain:</span> GLM 5.2
        <span className="text-slate-600">•</span>
        <span className="text-cyan-400">Hands:</span> Kimi K2.7 Code
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onRun={runTool} />
        ))}
      </div>
    </div>
  );
}
