import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import { createGoal } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus, Edit3, Trash2, ChevronDown, ChevronRight,
  Target, Calendar, CheckCircle2, PauseCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const LEVELS = ['year', 'quarter', 'month', 'week', 'day'];
const LEVEL_LABELS = { year: 'Yearly', quarter: 'Quarterly', month: 'Monthly', week: 'Weekly', day: 'Daily' };
const STATUSES = ['active', 'done', 'paused', 'dropped'];
const STATUS_ICONS = { active: AlertCircle, done: CheckCircle2, paused: PauseCircle, dropped: XCircle };
const STATUS_COLORS = { active: 'text-gold-400', done: 'text-emerald-400', paused: 'text-blue-400', dropped: 'text-rose-400' };

function GoalForm({ goal, onSave, onCancel }) {
  const { goals } = useApp();
  const [form, setForm] = useState({
    title: goal?.title || '',
    level: goal?.level || 'week',
    parentId: goal?.parentId || null,
    targetResult: goal?.targetResult || '',
    deadline: goal?.deadline || '',
    status: goal?.status || 'active',
  });

  const possibleParents = goals.filter((g) => {
    const gLevelIdx = LEVELS.indexOf(g.level);
    const formLevelIdx = LEVELS.indexOf(form.level);
    return gLevelIdx < formLevelIdx && g.status !== 'done' && g.status !== 'dropped';
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      ...form,
      id: goal?.id || uuidv4(),
      createdAt: goal?.createdAt || format(new Date(), 'yyyy-MM-dd'),
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
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <GlowCard glowColor="gold" className="p-6">
          <h3 className="text-lg font-semibold mb-5">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What do you want to achieve?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:border-gold-500/30 focus:bg-surface-200 transition-all"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Level</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all appearance-none cursor-pointer"
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all appearance-none cursor-pointer"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Target Result</label>
              <input
                value={form.targetResult}
                onChange={(e) => setForm({ ...form, targetResult: e.target.value })}
                placeholder="What does success look like?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:border-gold-500/30 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all"
                />
              </div>
              {possibleParents.length > 0 && (
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Parent Goal</label>
                  <select
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">None (top-level)</option>
                    {possibleParents.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.03] transition-all">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20">
                {goal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </form>
        </GlowCard>
      </div>
    </motion.div>
  );
}

function GoalNode({ goal, goals, onEdit, onDelete, depth = 0 }) {
  const children = goals.filter((g) => g.parentId === goal.id);
  const [expanded, setExpanded] = useState(true);
  const StatusIcon = STATUS_ICONS[goal.status] || AlertCircle;

  return (
    <div>
      <motion.div
        layout
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group ${depth > 0 ? 'ml-6' : ''}`}
      >
        {children.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-white/20 hover:text-white/50">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        {children.length === 0 && <div className="w-3.5" />}
        <div className={`w-1.5 h-1.5 rounded-full ${goal.status === 'active' ? 'bg-gold-400' : goal.status === 'done' ? 'bg-emerald-400' : goal.status === 'paused' ? 'bg-blue-400' : 'bg-rose-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${goal.level === 'year' ? 'bg-gold-500/15 text-gold-400' : goal.level === 'quarter' ? 'bg-accent-blue/15 text-accent-blue' : goal.level === 'month' ? 'bg-accent-purple/15 text-accent-purple' : goal.level === 'week' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-white/50'}`}>
              {LEVEL_LABELS[goal.level]}
            </span>
            <span className="text-sm font-medium truncate">{goal.title}</span>
          </div>
          {goal.targetResult && <p className="text-xs text-white/30 truncate mt-0.5">{goal.targetResult}</p>}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(goal)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-gold-400 transition-all">
            <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-rose-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <StatusIcon className={`w-4 h-4 ${STATUS_COLORS[goal.status]} flex-shrink-0`} strokeWidth={1.5} />
      </motion.div>
      <AnimatePresence>
        {expanded && children.map((child) => (
          <motion.div
            key={child.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GoalNode goal={child} goals={goals} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Goals() {
  const { goals, setGoals } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const sortedGoals = useMemo(() => {
    const getLevel = (g) => LEVELS.indexOf(g.level);
    return [...goals].sort((a, b) => getLevel(a) - getLevel(b));
  }, [goals]);

  const rootGoals = sortedGoals.filter((g) => !g.parentId);

  const handleSave = (goal) => {
    if (editingGoal) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
    } else {
      setGoals((prev) => [...prev, goal]);
    }
    setShowForm(false);
    setEditingGoal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this goal and all its children?')) {
      const deleteIds = new Set([id]);
      const findDescendants = (parentId) => {
        goals.filter((g) => g.parentId === parentId).forEach((g) => {
          deleteIds.add(g.id);
          findDescendants(g.id);
        });
      };
      findDescendants(id);
      setGoals((prev) => prev.filter((g) => !deleteIds.has(g.id)));
    }
  };

  const stats = {
    total: goals.length,
    active: goals.filter((g) => g.status === 'active').length,
    done: goals.filter((g) => g.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold">Goals</h1>
          <p className="text-white/40 mt-1 text-sm">Year → Quarter → Month → Week → Day</p>
        </div>
        <button
          onClick={() => { setEditingGoal(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlowCard className="text-center py-4">
          <span className="text-2xl font-bold text-gold-400">{stats.active}</span>
          <p className="text-xs text-white/30 mt-1">Active</p>
        </GlowCard>
        <GlowCard className="text-center py-4">
          <span className="text-2xl font-bold text-emerald-400">{stats.done}</span>
          <p className="text-xs text-white/30 mt-1">Done</p>
        </GlowCard>
        <GlowCard className="text-center py-4">
          <span className="text-2xl font-bold text-white/60">{stats.total}</span>
          <p className="text-xs text-white/30 mt-1">Total</p>
        </GlowCard>
      </div>

      {/* Goal Tree */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-gold-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold">Goal Tree</h2>
        </div>
        <div className="space-y-1">
          {rootGoals.length === 0 ? (
            <p className="text-sm text-white/30 italic py-8 text-center">No goals yet. Create your first goal to get started.</p>
          ) : (
            rootGoals.map((goal) => (
              <GoalNode key={goal.id} goal={goal} goals={sortedGoals} onEdit={(g) => { setEditingGoal(g); setShowForm(true); }} onDelete={handleDelete} />
            ))
          )}
        </div>
      </GlowCard>

      <AnimatePresence>
        {showForm && (
          <GoalForm
            goal={editingGoal}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingGoal(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}




