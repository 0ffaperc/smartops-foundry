import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import MetricCard from '../components/MetricCard';
import { getDateRange, filterTasksByRange } from '../lib/storage';
import { format, subDays } from 'date-fns';
import {
  BarChart3, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Target, Zap, Brain, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function WeeklyReview() {
  const { tasks, habits, habitLogs, reviews, today } = useApp();

  const weekRange = useMemo(() => {
    const now = new Date(today);
    const start = subDays(now, 6);
    return { start: format(start, 'yyyy-MM-dd'), end: today };
  }, [today]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(today), i);
      days.push(format(d, 'yyyy-MM-dd'));
    }
    return days;
  }, [today]);

  const weekTasks = useMemo(() => filterTasksByRange(tasks, weekRange.start, weekRange.end), [tasks, weekRange]);
  const weekReviews = useMemo(() => reviews.filter((r) => r.date >= weekRange.start && r.date <= weekRange.end), [reviews, weekRange]);

  const tasksCompleted = weekTasks.filter((t) => t.status === 'done').length;
  const tasksTotal = weekTasks.length;

  const goodHabits = habits.filter((h) => h.type === 'good' && h.active);
  const badHabits = habits.filter((h) => h.type === 'bad' && h.active);

  const habitCompletion = useMemo(() => {
    let total = 0;
    let done = 0;
    weekDays.forEach((day) => {
      goodHabits.forEach((h) => {
        total++;
        if (habitLogs.some((l) => l.date === day && l.habitId === h.id && l.completed)) done++;
      });
    });
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [weekDays, goodHabits, habitLogs]);

  const badAvoided = useMemo(() => {
    let total = 0;
    let avoided = 0;
    weekDays.forEach((day) => {
      badHabits.forEach((h) => {
        total++;
        if (habitLogs.some((l) => l.date === day && l.habitId === h.id && l.completed)) avoided++;
      });
    });
    return { avoided, total, pct: total > 0 ? Math.round((avoided / total) * 100) : 0 };
  }, [weekDays, badHabits, habitLogs]);

  // Chart data
  const chartData = useMemo(() => {
    return weekDays.map((day) => {
      const dayTasks = weekTasks.filter((t) => t.date === day);
      const dayDone = dayTasks.filter((t) => t.status === 'done').length;
      const dayReview = reviews.find((r) => r.date === day);
      return {
        date: format(new Date(day), 'EEE'),
        tasks: dayDone,
        mood: dayReview?.mood || null,
        energy: dayReview?.energy || null,
        total: dayTasks.length,
      };
    });
  }, [weekDays, weekTasks, reviews]);

  const avgMood = weekReviews.length > 0 ? Math.round(weekReviews.reduce((s, r) => s + r.mood, 0) / weekReviews.length) : 0;
  const avgEnergy = weekReviews.length > 0 ? Math.round(weekReviews.reduce((s, r) => s + r.energy, 0) / weekReviews.length) : 0;

  // Find strongest and weakest categories
  const categories = useMemo(() => {
    const taskPct = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
    return [
      { name: 'Tasks', value: taskPct, icon: CheckCircle2, color: 'gold' },
      { name: 'Habits', value: habitCompletion.pct, icon: Zap, color: 'emerald' },
      { name: 'Avoidance', value: badAvoided.pct, icon: XCircle, color: 'rose' },
      { name: 'Reviews', value: weekReviews.length >= 5 ? 100 : Math.round((weekReviews.length / 7) * 100), icon: Brain, color: 'blue' },
    ];
  }, [tasksCompleted, tasksTotal, habitCompletion.pct, badAvoided.pct, weekReviews.length]);

  const strongest = useMemo(() => categories.reduce((a, b) => (a.value > b.value ? a : b)), [categories]);
  const weakest = useMemo(() => categories.reduce((a, b) => (a.value < b.value ? a : b)), [categories]);

  // Repeated mistakes
  const allMistakes = weekReviews.map((r) => r.mistakes).filter(Boolean);
  const repeatedMistakes = useMemo(() => {
    const counts = {};
    allMistakes.forEach((m) => {
      const phrases = m.split(/[,.]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
      phrases.forEach((p) => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [allMistakes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold">Weekly Review</h1>
        <p className="text-white/40 mt-1 text-sm">{weekRange.start} → {weekRange.end}</p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Tasks Completed"
          value={`${tasksCompleted}/${tasksTotal}`}
          subtitle={tasksTotal > 0 ? `${Math.round((tasksCompleted / tasksTotal) * 100)}%` : 'No tasks'}
          icon={CheckCircle2}
          color="gold"
          glow
        />
        <MetricCard
          label="Habits Done"
          value={`${habitCompletion.done}/${habitCompletion.total}`}
          subtitle={`${habitCompletion.pct}%`}
          icon={Zap}
          color="emerald"
          glow
        />
        <MetricCard
          label="Bad Habits Avoided"
          value={`${badAvoided.avoided}/${badAvoided.total}`}
          subtitle={`${badAvoided.pct}%`}
          icon={XCircle}
          color="blue"
          glow
        />
        <MetricCard
          label="Avg Mood / Energy"
          value={`${avgMood}/${avgEnergy}`}
          subtitle="mood / energy"
          icon={Brain}
          color="purple"
          glow
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Chart */}
        <GlowCard className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4">Daily Progress This Week</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111118',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="tasks" stroke="#f59e0b" fill="url(#tasksGrad)" strokeWidth={2} dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }} name="Tasks Done" />
                <Area type="monotone" dataKey="mood" stroke="#34d399" fill="url(#moodGrad)" strokeWidth={2} dot={{ fill: '#34d399', strokeWidth: 0, r: 3 }} name="Mood" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        {/* Strongest / Weakest */}
        <GlowCard>
          <h2 className="text-sm font-semibold mb-4">Category Analysis</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                <span className="text-xs font-medium text-emerald-400">Strongest</span>
              </div>
              <p className="text-lg font-bold text-emerald-400">{strongest.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{strongest.value}% completion rate</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
                <span className="text-xs font-medium text-rose-400">Weakest</span>
              </div>
              <p className="text-lg font-bold text-rose-400">{weakest.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{weakest.value}% completion rate</p>
            </div>
          </div>
        </GlowCard>

        {/* Repeated Mistakes */}
        <GlowCard>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
            Repeated Mistakes
          </h2>
          {repeatedMistakes.length === 0 ? (
            <p className="text-sm text-white/30 italic">No repeated mistakes identified.</p>
          ) : (
            <div className="space-y-2">
              {repeatedMistakes.map(([mistake, count], i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-200/40">
                  <span className="text-sm text-white/70 truncate flex-1">{mistake}</span>
                  <span className="text-xs font-mono text-rose-400/60 ml-2">×{count}</span>
                </div>
              ))}
            </div>
          )}
        </GlowCard>

        {/* Next Week Focus */}
        <GlowCard glowColor="gold" className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
            <h2 className="text-base font-semibold">Next Week Focus</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-surface-200/50 border border-white/[0.04]">
              <p className="text-xs text-emerald-400 font-medium mb-1">Continue</p>
              <p className="text-sm text-white/70">{strongest.name} — you're building momentum here.</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-200/50 border border-white/[0.04]">
              <p className="text-xs text-rose-400 font-medium mb-1">Improve</p>
              <p className="text-sm text-white/70">{weakest.name} — this needs more attention.</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-200/50 border border-white/[0.04]">
              <p className="text-xs text-gold-400 font-medium mb-1">Start</p>
              <p className="text-sm text-white/70">
                {repeatedMistakes.length > 0 ? `Address: ${repeatedMistakes[0][0]}` : 'Set a new stretch goal.'}
              </p>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}




