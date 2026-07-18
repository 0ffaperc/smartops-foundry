import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import ProgressRing from '../components/ProgressRing';
import { createHabit, createHabitLog, getHabitStreak } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Plus, Edit3, Trash2, RefreshCw, Flame,
  CheckCircle2, XCircle, Eye, EyeOff,
} from 'lucide-react';

function HabitForm({ habit, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: habit?.name || '',
    type: habit?.type || 'good',
    active: habit?.active !== undefined ? habit.active : true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: habit?.id || uuidv4(),
      createdAt: habit?.createdAt || format(new Date(), 'yyyy-MM-dd'),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <GlowCard glowColor={form.type === 'good' ? 'emerald' : 'rose'} className="p-6">
          <h3 className="text-lg font-semibold mb-5">{habit ? 'Edit Habit' : 'New Habit'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === 'good' ? 'e.g., Morning meditation' : 'e.g., Doom scrolling'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:border-gold-500/30 transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'good' })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.type === 'good'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-surface-200/50 text-white/30 border border-transparent hover:text-white/50'
                  }`}
                >
                  Good Habit
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'bad' })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.type === 'bad'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      : 'bg-surface-200/50 text-white/30 border border-transparent hover:text-white/50'
                  }`}
                >
                  Bad Habit
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/50 hover:text-white/70 transition-all">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20">
                {habit ? 'Save' : 'Create Habit'}
              </button>
            </div>
          </form>
        </GlowCard>
      </div>
    </motion.div>
  );
}

function HabitCard({ habit, habitLogs, today, onToggle, onEdit, onDelete }) {
  const streak = getHabitStreak(habitLogs, habit.id, today);
  const todayLog = habitLogs.find((l) => l.date === today && l.habitId === habit.id);
  const completed = todayLog?.completed || false;

  const isGood = habit.type === 'good';

  const weekLogs = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = format(d, 'yyyy-MM-dd');
    const log = habitLogs.find((l) => l.date === ds && l.habitId === habit.id);
    weekLogs.push({ date: ds, done: log?.completed || false, dayName: format(d, 'EEE').charAt(0) });
  }

  return (
    <GlowCard glowColor={isGood ? 'emerald' : 'rose'} className={!habit.active ? 'opacity-50' : ''}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => habit.active && onToggle(habit.id, !completed)}
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              completed
                ? isGood ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                : 'bg-surface-200/50 text-white/20 hover:text-white/40'
            }`}
          >
            {completed ? (
              isGood ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
            ) : (
              <RefreshCw className="w-4.5 h-4.5" strokeWidth={1.5} />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{habit.name}</p>
            <p className={`text-[11px] font-medium mt-0.5 ${isGood ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
              {isGood ? (completed ? 'Done today' : 'Not done yet') : (completed ? 'Avoided today' : 'Watch out')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold-500/10">
              <Flame className="w-3 h-3 text-gold-400" strokeWidth={1.5} />
              <span className="text-xs font-mono text-gold-400">{streak}</span>
            </div>
          )}
          <button onClick={() => onEdit(habit)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-gold-400 transition-all">
            <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={() => onDelete(habit.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-rose-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Week mini-chart */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
        {weekLogs.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-full h-1.5 rounded-full transition-all ${
              day.done
                ? isGood ? 'bg-emerald-400' : 'bg-rose-400'
                : 'bg-white/[0.06]'
            }`} />
            <span className="text-[9px] text-white/20">{day.dayName}</span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

export default function Habits() {
  const { habits, setHabits, habitLogs, setHabitLogs, today } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeHabits = useMemo(() => habits.filter((h) => showInactive ? true : h.active), [habits, showInactive]);
  const goodHabits = activeHabits.filter((h) => h.type === 'good');
  const badHabits = activeHabits.filter((h) => h.type === 'bad');

  const todayGoodLogs = habitLogs.filter((l) => l.date === today && l.completed && habits.find((h) => h.id === l.habitId)?.type === 'good');
  const todayBadLogs = habitLogs.filter((l) => l.date === today && l.completed && habits.find((h) => h.id === l.habitId)?.type === 'bad');

  const handleSave = (habit) => {
    if (editingHabit) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
    } else {
      setHabits((prev) => [...prev, habit]);
    }
    setShowForm(false);
    setEditingHabit(null);
  };

  const handleDelete = (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setHabitLogs((prev) => prev.filter((l) => l.habitId !== id));
  };

  const handleToggle = (habitId, completed) => {
    const existing = habitLogs.find((l) => l.date === today && l.habitId === habitId);
    if (existing) {
      setHabitLogs((prev) => prev.map((l) => (l.id === existing.id ? { ...l, completed } : l)));
    } else {
      setHabitLogs((prev) => [...prev, { id: uuidv4(), habitId, date: today, completed }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold">Habits</h1>
          <p className="text-white/40 mt-1 text-sm">Track what matters. Break what doesn't.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`p-2.5 rounded-xl transition-all ${
              showInactive ? 'bg-gold-500/10 text-gold-400' : 'bg-surface-100/50 text-white/30 hover:text-white/50'
            }`}
            title={showInactive ? 'Hide inactive' : 'Show inactive'}
          >
            {showInactive ? <Eye className="w-4 h-4" strokeWidth={1.5} /> : <EyeOff className="w-4 h-4" strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => { setEditingHabit(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Today's Progress */}
      <div className="grid grid-cols-2 gap-4">
        <GlowCard glowColor="emerald" className="text-center py-5">
          <ProgressRing
            progress={goodHabits.length > 0 ? (todayGoodLogs.length / goodHabits.length) * 100 : 0}
            size={100}
            strokeWidth={6}
            color="#34d399"
            label="Good Habits"
          >
            <span className="text-lg font-bold text-emerald-400">{todayGoodLogs.length}/{goodHabits.length}</span>
          </ProgressRing>
        </GlowCard>
        <GlowCard glowColor="rose" className="text-center py-5">
          <ProgressRing
            progress={badHabits.length > 0 ? (todayBadLogs.length / badHabits.length) * 100 : 0}
            size={100}
            strokeWidth={6}
            color="#fb7185"
            label="Bad Habits Avoided"
          >
            <span className="text-lg font-bold text-rose-400">{todayBadLogs.length}/{badHabits.length}</span>
          </ProgressRing>
        </GlowCard>
      </div>

      {/* Good Habits */}
      <div>
        <h2 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
          Good Habits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goodHabits.length === 0 ? (
            <p className="text-sm text-white/30 italic col-span-2 py-4 text-center">No good habits defined.</p>
          ) : (
            goodHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                habitLogs={habitLogs}
                today={today}
                onToggle={handleToggle}
                onEdit={(h) => { setEditingHabit(h); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Bad Habits */}
      <div>
        <h2 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
          <XCircle className="w-4 h-4" strokeWidth={1.5} />
          Bad Habits to Avoid
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {badHabits.length === 0 ? (
            <p className="text-sm text-white/30 italic col-span-2 py-4 text-center">No bad habits tracked.</p>
          ) : (
            badHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                habitLogs={habitLogs}
                today={today}
                onToggle={handleToggle}
                onEdit={(h) => { setEditingHabit(h); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <HabitForm
            habit={editingHabit}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingHabit(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}




