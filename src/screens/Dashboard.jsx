import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../App';
import MetricCard from '../components/MetricCard';
import GlowCard from '../components/GlowCard';
import ProgressRing from '../components/ProgressRing';
import { computeDailyScore, filterTasksByDate, getHabitLogsForDate, getHabitStreak } from '../lib/storage';
import { format } from 'date-fns';
import {
  TrendingUp, Target, ListTodo, RefreshCw, Zap,
  Brain, FileText, Flame, Calendar, ArrowRight,
  CheckCircle2, Circle, AlertCircle,
} from 'lucide-react';

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function Dashboard() {
  const { goals, tasks, habits, habitLogs, reviews, today, setCurrentScreen } = useApp();

  const score = useMemo(() => computeDailyScore(tasks, habits, habitLogs, reviews, today), [tasks, habits, habitLogs, reviews, today]);

  const todayTasks = useMemo(() => filterTasksByDate(tasks, today).sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
  }), [tasks, today]);

  const todayLogs = useMemo(() => getHabitLogsForDate(habitLogs, today), [habitLogs, today]);

  const goodHabits = habits.filter((h) => h.type === 'good' && h.active);
  const badHabits = habits.filter((h) => h.type === 'bad' && h.active);

  const topTasks = todayTasks.filter((t) => t.status !== 'done').slice(0, 3);
  const doneTasks = todayTasks.filter((t) => t.status === 'done').length;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const weeklyGoals = activeGoals.filter((g) => g.level === 'week');
  const monthlyGoals = activeGoals.filter((g) => g.level === 'month');

  const todayReview = reviews.find((r) => r.date === today);

  const todaysDate = format(new Date(today), 'EEEE, MMMM do');

  const scoreColor = score >= 80 ? 'emerald' : score >= 60 ? 'gold' : 'rose';
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-white/40 mt-1 text-sm">{todaysDate}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200/60 border border-white/[0.05]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/50">Live</span>
          </div>
        </div>
      </motion.div>

      {/* Score + Top Metrics */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <GlowCard glowColor={scoreColor} className="lg:col-span-1 flex flex-col items-center justify-center py-6">
          <ProgressRing
            progress={score}
            size={140}
            strokeWidth={8}
            color={score >= 80 ? '#34d399' : score >= 60 ? '#f59e0b' : '#fb7185'}
            label="Daily Score"
          >
            <div className="text-center">
              <span className="text-3xl font-bold block">{score}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/30">{scoreLabel}</span>
            </div>
          </ProgressRing>
        </GlowCard>

        <MetricCard
          label="Tasks Done"
          value={`${doneTasks}/${todayTasks.length}`}
          subtitle={topTasks.length > 0 ? `${topTasks.length} remaining` : 'All done!'}
          icon={ListTodo}
          color="gold"
          glow
          onClick={() => setCurrentScreen('tasks')}
        />
        <MetricCard
          label="Active Goals"
          value={activeGoals.length}
          subtitle={`${weeklyGoals.length} weekly · ${monthlyGoals.length} monthly`}
          icon={Target}
          color="emerald"
          glow
          onClick={() => setCurrentScreen('goals')}
        />
        <MetricCard
          label="Good Habits"
          value={`${goodHabits.filter((h) => todayLogs.some((l) => l.habitId === h.id)).length}/${goodHabits.length}`}
          subtitle="Completed today"
          icon={Zap}
          color="blue"
          glow
          onClick={() => setCurrentScreen('habits')}
        />
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Today's Top 3 */}
        <motion.div variants={fadeUp} className="lg:col-span-1">
          <GlowCard glowColor="gold">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80">Today's Top 3</h2>
              <Brain className="w-4 h-4 text-gold-400/60" strokeWidth={1.5} />
            </div>
            <div className="space-y-3">
              {topTasks.length === 0 ? (
                <p className="text-sm text-white/30 italic">No pending tasks — enjoy the clarity!</p>
              ) : (
                topTasks.map((task, i) => (
                  <div key={task.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${i === 0 ? 'bg-gold-500/20 text-gold-400' : i === 1 ? 'bg-white/[0.06] text-white/50' : 'bg-white/[0.04] text-white/30'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] uppercase tracking-wider font-medium
                          ${task.priority === 'high' ? 'text-rose-400' : task.priority === 'medium' ? 'text-gold-400' : 'text-white/30'}`}>
                          {task.priority}
                        </span>
                        {task.goalId && <span className="text-[10px] text-white/20">· linked</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlowCard>
        </motion.div>

        {/* Today's Task List */}
        <motion.div variants={fadeUp} className="lg:col-span-1">
          <GlowCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80">Today's Tasks</h2>
              <span className="text-xs text-white/30">{todayTasks.length} total</span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto scrollable pr-1">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-white/30 italic">No tasks for today.</p>
              ) : (
                todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
                    ) : task.status === 'doing' ? (
                      <Zap className="w-4 h-4 text-gold-400 flex-shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Circle className="w-4 h-4 text-white/20 flex-shrink-0" strokeWidth={1.5} />
                    )}
                    <span className={`text-sm flex-1 truncate ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}>
                      {task.title}
                    </span>
                    <span className={`text-[10px] uppercase font-medium
                      ${task.priority === 'high' ? 'text-rose-400/70' : task.priority === 'medium' ? 'text-gold-400/50' : 'text-white/20'}`}>
                      {task.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setCurrentScreen('tasks')}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all"
            >
              <span>View all tasks</span>
              <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </GlowCard>
        </motion.div>

        {/* Habits + Goals Quick View */}
        <motion.div variants={fadeUp} className="lg:col-span-1 space-y-4">
          {/* Good Habits */}
          <GlowCard glowColor="emerald">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80">Good Habits</h2>
              <Flame className="w-4 h-4 text-emerald-400/60" strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              {goodHabits.slice(0, 4).map((habit) => {
                const done = todayLogs.some((l) => l.habitId === habit.id);
                const streak = getHabitStreak(habitLogs, habit.id, today);
                return (
                  <div key={habit.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-400' : 'bg-white/[0.08]'}`} />
                      <span className={`text-xs ${done ? 'text-white/70' : 'text-white/30'}`}>{habit.name}</span>
                    </div>
                    {streak > 0 && (
                      <span className="text-[10px] text-gold-400/60 font-mono">{streak}d</span>
                    )}
                  </div>
                );
              })}
              {goodHabits.length === 0 && <p className="text-xs text-white/20 italic">No good habits set.</p>}
            </div>
          </GlowCard>

          {/* Bad Habits */}
          <GlowCard glowColor="rose">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80">Avoid These</h2>
              <AlertCircle className="w-4 h-4 text-rose-400/60" strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              {badHabits.slice(0, 4).map((habit) => {
                const avoided = todayLogs.some((l) => l.habitId === habit.id);
                return (
                  <div key={habit.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${avoided ? 'bg-emerald-400' : 'bg-rose-400/60'}`} />
                      <span className={`text-xs ${avoided ? 'text-white/70 line-through' : 'text-rose-300/80'}`}>{habit.name}</span>
                    </div>
                    {avoided && <span className="text-[10px] text-emerald-400/60">avoided</span>}
                  </div>
                );
              })}
              {badHabits.length === 0 && <p className="text-xs text-white/20 italic">No bad habits tracked.</p>}
            </div>
          </GlowCard>
        </motion.div>
      </div>

      {/* Bottom Row: Linked Goals + Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <motion.div variants={fadeUp}>
          <GlowCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80">Linked Weekly & Monthly Goals</h2>
              <Target className="w-4 h-4 text-white/30" strokeWidth={1.5} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...weeklyGoals.slice(0, 2), ...monthlyGoals.slice(0, 2)].length === 0 ? (
                <p className="text-sm text-white/30 italic col-span-2">No active goals at this level.</p>
              ) : (
                [...weeklyGoals.slice(0, 2), ...monthlyGoals.slice(0, 2)].map((goal) => (
                  <div key={goal.id} className="p-3 rounded-xl bg-surface-200/50 border border-white/[0.04]">
                    <span className="text-[10px] uppercase tracking-wider text-white/20 font-medium">{goal.level}</span>
                    <p className="text-sm font-medium mt-1 truncate">{goal.title}</p>
                    <p className="text-[11px] text-white/30 mt-1 truncate">{goal.targetResult || 'No target defined'}</p>
                  </div>
                ))
              )}
            </div>
          </GlowCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlowCard glowColor="blue">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80">Quick Review</h2>
              <FileText className="w-4 h-4 text-white/30" strokeWidth={1.5} />
            </div>
            {todayReview ? (
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <span className="text-[10px] uppercase text-white/20">Mood</span>
                    <p className="text-lg font-bold">{todayReview.mood}/10</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/20">Energy</span>
                    <p className="text-lg font-bold">{todayReview.energy}/10</p>
                  </div>
                </div>
                <p className="text-sm text-white/60 line-clamp-2">{todayReview.notes || 'No notes.'}</p>
                <button
                  onClick={() => setCurrentScreen('dailyReview')}
                  className="mt-3 text-xs text-gold-400/80 hover:text-gold-400 flex items-center gap-1"
                >
                  View full review <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-white/30 mb-4">You haven't reviewed today yet.</p>
                <button
                  onClick={() => setCurrentScreen('dailyReview')}
                  className="px-4 py-2 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 text-sm font-medium hover:bg-gold-500/15 transition-colors"
                >
                  Write Review
                </button>
              </div>
            )}
          </GlowCard>
        </motion.div>
      </div>
    </motion.div>
  );
}




