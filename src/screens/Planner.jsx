import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import {
  Brain, Lightbulb, RefreshCw, CheckCircle2,
  AlertTriangle, Sparkles, ClipboardCheck,
  ArrowRight, Clock, Target, Zap, X,
} from 'lucide-react';
import { mockGeneratePlannerQuestions, mockBuildPlan, mockCritiquePlan, mockImprovePlan } from '../lib/mockAi';

const AGENT_PHASES = {
  idle: { label: 'Ready', color: 'text-white/30' },
  planning: { label: 'Planning...', color: 'text-gold-400' },
  critique: { label: 'Critiquing...', color: 'text-blue-400' },
  improving: { label: 'Improving...', color: 'text-purple-400' },
  done: { label: 'Complete', color: 'text-emerald-400' },
};

export default function Planner() {
  const { plannerProfile, setPlannerProfile, goals, today, setCurrentScreen, setTasks, tasks } = useApp();
  const [questions, setQuestions] = useState(() => mockGeneratePlannerQuestions(plannerProfile));
  const [answers, setAnswers] = useState(() => questions.map((q) => ({ id: q.id, value: q.default || '' })));
  const [plan, setPlan] = useState(null);
  const [critique, setCritique] = useState(null);
  const [improvedPlan, setImprovedPlan] = useState(null);
  const [agentPhase, setAgentPhase] = useState('idle');
  const [agentLog, setAgentLog] = useState([]);
  const [selectedTab, setSelectedTab] = useState('interview');

  const handleAnswerChange = (id, value) => {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, value } : a)));
  };

  const handleSaveProfile = () => {
    const profile = {
      wakeTime: answers.find((a) => a.id === 'q1')?.value || '',
      sleepTime: answers.find((a) => a.id === 'q2')?.value || '',
      fixedCommitments: answers.find((a) => a.id === 'q3')?.value || '',
      deepWorkHours: parseInt(answers.find((a) => a.id === 'q4')?.value) || 4,
      scheduleConstraints: answers.find((a) => a.id === 'q9')?.value || '',
      habitsFocus: answers.find((a) => a.id === 'q7')?.value || '',
      badHabitsToAvoid: answers.find((a) => a.id === 'q8')?.value || '',
    };
    setPlannerProfile(profile);
  };

  const handleBuildPlan = () => {
    const newPlan = mockBuildPlan(answers);
    setPlan(newPlan);
    setCritique(null);
    setImprovedPlan(null);
    setAgentPhase('idle');
    setSelectedTab('plan');
  };

  const handleCreateTasks = () => {
    if (!plan?.schedule) return;
    const newTasks = plan.schedule
      .filter((b) => b.type === 'must-do' || b.type === 'deep')
      .map((b, i) => ({
        id: `generated-${Date.now()}-${i}`,
        goalId: null,
        title: b.title,
        date: today,
        priority: 'high',
        status: 'todo',
        createdAt: new Date().toISOString().split('T')[0],
      }));
    setTasks((prev) => [...prev, ...newTasks]);
    setSelectedTab('plan');
  };

  // Agent Loop: Plan → Critique → Improve
  const runAgentLoop = async () => {
    setAgentLog([]);
    setAgentPhase('planning');
    addLog('info', 'Starting agent loop: Plan → Critique → Improve');

    // Step 1: Plan
    await sleep(600);
    const p = mockBuildPlan(answers);
    setPlan(p);
    addLog('success', 'Plan generated successfully');
    addLog('info', `Deep work: ${p.schedule?.find((b) => b.type === 'deep')?.time || 'N/A'}`);

    // Step 2: Critique
    setAgentPhase('critique');
    await sleep(800);
    const c = mockCritiquePlan(p);
    setCritique(c);
    addLog('warning', `Critique score: ${c.score}/100`);
    c.warnings.forEach((w) => addLog('warning', `Warning: ${w}`));
    c.suggestions.forEach((s) => addLog('suggestion', `Suggestion: ${s}`));

    // Step 3: Improve
    setAgentPhase('improving');
    await sleep(600);
    const ip = mockImprovePlan(p, c);
    setImprovedPlan(ip);
    addLog('success', `Plan improved — score now ${ip.critiqueScore}/100`);
    addLog('done', 'Agent loop complete. Ready to execute.');

    setAgentPhase('done');
    setSelectedTab('plan');
  };

  const addLog = (type, message) => {
    setAgentLog((prev) => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const activePlan = improvedPlan || plan;

  const weeklyGoals = goals.filter((g) => g.level === 'week' && g.status === 'active');

  const typeColors = {
    ritual: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
    deep: 'bg-accent-purple/15 text-accent-purple border-accent-purple/20',
    commitment: 'bg-accent-blue/15 text-accent-blue border-accent-blue/20',
    break: 'bg-white/[0.04] text-white/40 border-white/[0.06]',
    shallow: 'bg-white/[0.04] text-white/50 border-white/[0.06]',
    'must-do': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    review: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
    personal: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
    sleep: 'bg-accent-blue/8 text-accent-blue border-accent-blue/15',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-gold-400" strokeWidth={1.5} />
            Planner
          </h1>
          <p className="text-white/40 mt-1 text-sm">Interview → Plan → Critique → Improve → Execute</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
          agentPhase === 'done' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/8' :
          agentPhase === 'idle' ? 'border-white/[0.06] text-white/30' :
          'border-gold-500/20 text-gold-400 bg-gold-500/8'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            agentPhase === 'done' ? 'bg-emerald-400' :
            agentPhase === 'idle' ? 'bg-white/20' :
            'bg-gold-400 animate-pulse'
          }`} />
          <span>{AGENT_PHASES[agentPhase]?.label || 'Ready'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-100/80 border border-white/[0.04] w-fit">
        {[
          { id: 'interview', label: 'Interview', icon: ClipboardCheck },
          { id: 'plan', label: 'Plan', icon: Sparkles },
          { id: 'agent', label: 'Agent Loop', icon: RefreshCw },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedTab === tab.id
                  ? 'bg-surface-200/80 text-white border border-white/[0.06] shadow-sm'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* INTERVIEW TAB */}
        {selectedTab === 'interview' && (
          <motion.div
            key="interview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <GlowCard glowColor="gold">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardCheck className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
                <h2 className="text-base font-semibold">Tomorrow's Interview</h2>
              </div>
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id}>
                    <label className="text-sm text-white/70 font-medium mb-1.5 block">{q.question}</label>
                    <input
                      value={answers.find((a) => a.id === q.id)?.value || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Type your answer..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/60 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/[0.04]">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-xs text-white/50 hover:text-white/70 transition-all"
                >
                  Save as Profile
                </button>
                <button
                  onClick={handleBuildPlan}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  Build Tomorrow Plan
                </button>
                <button
                  onClick={() => { handleBuildPlan(); runAgentLoop(); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-accent-purple/20"
                >
                  <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                  Agent Loop
                </button>
              </div>
            </GlowCard>
          </motion.div>
        )}

        {/* PLAN TAB */}
        {selectedTab === 'plan' && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {activePlan ? (
              <>
                {/* Summary */}
                <GlowCard glowColor="gold">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
                    <h2 className="text-base font-semibold">Tomorrow's Plan</h2>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{activePlan.summary}</p>
                  {activePlan.focusAreas?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {activePlan.focusAreas.map((area, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-gold-500/10 text-gold-400 text-xs border border-gold-500/15">
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                  {activePlan.warnings?.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-500/8 border border-rose-500/15">
                      {activePlan.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Ritual Blocks */}
                  {activePlan.morningRitual && (
                    <div className="mt-4 p-3 rounded-xl bg-gold-500/5 border border-gold-500/10">
                      <p className="text-[10px] uppercase tracking-wider text-gold-400/60 font-medium">Morning Ritual</p>
                      <p className="text-sm text-white/60 mt-1">{activePlan.morningRitual}</p>
                    </div>
                  )}
                  {activePlan.eveningRitual && (
                    <div className="mt-2 p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
                      <p className="text-[10px] uppercase tracking-wider text-accent-blue/60 font-medium">Evening Ritual</p>
                      <p className="text-sm text-white/60 mt-1">{activePlan.eveningRitual}</p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                    <button
                      onClick={handleCreateTasks}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                      Create Tomorrow Tasks
                    </button>
                  </div>
                </GlowCard>

                {/* Schedule */}
                {activePlan.schedule && (
                  <GlowCard>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-4 h-4 text-gold-400" strokeWidth={1.5} />
                      <h2 className="text-sm font-semibold">Schedule</h2>
                    </div>
                    <div className="space-y-2">
                      {activePlan.schedule.map((block, i) => {
                        const colors = typeColors[block.type] || typeColors.shallow;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-200/40 hover:bg-surface-200/60 transition-all"
                          >
                            <span className="text-xs font-mono text-white/40 w-16 flex-shrink-0">{block.time}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                              {block.type}
                            </span>
                            <span className="text-sm flex-1">{block.title}</span>
                            <span className="text-xs text-white/30">{block.duration}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </GlowCard>
                )}

                {/* Critique Result */}
                {critique && (
                  <GlowCard glowColor="blue">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                      <h2 className="text-sm font-semibold">Critique</h2>
                      <span className="text-xs font-mono text-blue-400/60 ml-auto">Score: {critique.score}/100</span>
                    </div>
                    <p className="text-sm text-white/60">{critique.verdict}</p>
                    {critique.suggestions?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {critique.suggestions.map((s, i) => (
                          <p key={i} className="text-xs text-blue-300 flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3" strokeWidth={2} />
                            {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </GlowCard>
                )}

                {/* Weekly Goals Reference */}
                {weeklyGoals.length > 0 && (
                  <GlowCard>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-white/40" strokeWidth={1.5} />
                      <h2 className="text-sm font-semibold">Linked Weekly Goals</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weeklyGoals.map((g) => (
                        <span key={g.id} className="px-2.5 py-1.5 rounded-lg bg-surface-200/50 text-xs text-white/50 border border-white/[0.04]">
                          {g.title}
                        </span>
                      ))}
                    </div>
                  </GlowCard>
                )}
              </>
            ) : (
              <GlowCard className="text-center py-12">
                <Brain className="w-12 h-12 text-white/10 mx-auto mb-4" strokeWidth={1} />
                <p className="text-white/30">Complete the interview first, then build your plan.</p>
                <button
                  onClick={() => setSelectedTab('interview')}
                  className="mt-4 text-sm text-gold-400 hover:text-gold-300 transition-colors"
                >
                  Go to Interview →
                </button>
              </GlowCard>
            )}
          </motion.div>
        )}

        {/* AGENT LOOP TAB */}
        {selectedTab === 'agent' && (
          <motion.div
            key="agent"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <GlowCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
                  <h2 className="text-base font-semibold">Agent Control</h2>
                </div>
                <div className={`text-xs font-mono ${AGENT_PHASES[agentPhase]?.color}`}>
                  {AGENT_PHASES[agentPhase]?.label}
                </div>
              </div>

              {agentPhase === 'idle' && (
                <p className="text-sm text-white/40 mb-4">
                  Run the full agent pipeline: generate a plan, critique it, and improve it automatically.
                </p>
              )}

              {/* Agent Log */}
              {agentLog.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-surface-200/50 border border-white/[0.04] max-h-48 overflow-y-auto scrollable space-y-1.5">
                  {agentLog.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-white/20 font-mono flex-shrink-0">{log.time}</span>
                      <span className={`${
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'warning' ? 'text-gold-400' :
                        log.type === 'suggestion' ? 'text-blue-400' :
                        log.type === 'done' ? 'text-emerald-400' :
                        'text-white/50'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={runAgentLoop}
                  disabled={agentPhase !== 'idle' && agentPhase !== 'done'}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                    agentPhase === 'idle' || agentPhase === 'done'
                      ? 'bg-gradient-to-r from-accent-purple to-accent-blue text-white hover:opacity-90 shadow-accent-purple/20'
                      : 'bg-surface-200/50 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {agentPhase === 'idle' ? (
                    <>Start Agent Loop</>
                  ) : agentPhase === 'done' ? (
                    <>Run Again</>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                      Running...
                    </span>
                  )}
                </button>

                {(agentPhase === 'planning' || agentPhase === 'critique' || agentPhase === 'improving') && (
                  <button
                    onClick={() => setAgentPhase('idle')}
                    className="px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-xs font-medium hover:bg-rose-500/10 transition-all"
                  >
                    Stop
                  </button>
                )}

                {agentPhase === 'done' && (
                  <button
                    onClick={handleCreateTasks}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                    Create Tasks
                  </button>
                )}
              </div>
            </GlowCard>

            {/* Current State Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <GlowCard glowColor="gold" className={`text-center py-4 ${!plan ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${plan ? 'bg-gold-400' : 'bg-white/10'}`} />
                  <span className="text-xs font-medium text-white/40">1. Plan</span>
                </div>
                <p className="text-lg font-bold text-gold-400">{plan ? '✓' : '—'}</p>
                <p className="text-[10px] text-white/30 mt-1">{plan ? `${plan.schedule?.length || 0} blocks` : 'Not generated'}</p>
              </GlowCard>
              <GlowCard glowColor="blue" className={`text-center py-4 ${!critique ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${critique ? 'bg-blue-400' : 'bg-white/10'}`} />
                  <span className="text-xs font-medium text-white/40">2. Critique</span>
                </div>
                <p className="text-lg font-bold text-blue-400">{critique ? critique.score : '—'}</p>
                <p className="text-[10px] text-white/30 mt-1">{critique ? `${critique.warnings.length} warnings` : 'Not critiqued'}</p>
              </GlowCard>
              <GlowCard glowColor="purple" className={`text-center py-4 ${!improvedPlan ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${improvedPlan ? 'bg-purple-400' : 'bg-white/10'}`} />
                  <span className="text-xs font-medium text-white/40">3. Improve</span>
                </div>
                <p className="text-lg font-bold text-purple-400">{improvedPlan ? '✓' : '—'}</p>
                <p className="text-[10px] text-white/30 mt-1">{improvedPlan ? 'Optimized' : 'Not improved'}</p>
              </GlowCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




