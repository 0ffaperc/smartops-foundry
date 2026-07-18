import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import { createTask } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Plus, Edit3, Trash2, ListTodo, Calendar,
  CheckCircle2, Circle, Zap, SkipForward,
  Filter, ArrowUpDown,
} from 'lucide-react';

const PRIORITIES = ['high', 'medium', 'low'];
const STATUSES = ['todo', 'doing', 'done', 'skipped'];
const PRIORITY_COLORS = { high: 'text-rose-400', medium: 'text-gold-400', low: 'text-white/30' };

function TaskForm({ task, onSave, onCancel }) {
  const { goals, today } = useApp();
  const [form, setForm] = useState({
    title: task?.title || '',
    date: task?.date || today,
    priority: task?.priority || 'medium',
    status: task?.status || 'todo',
    goalId: task?.goalId || null,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      ...form,
      id: task?.id || uuidv4(),
      createdAt: task?.createdAt || format(new Date(), 'yyyy-MM-dd'),
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
        <GlowCard glowColor="gold" className="p-6">
          <h3 className="text-lg font-semibold mb-5">{task ? 'Edit Task' : 'New Task'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to be done?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:border-gold-500/30 transition-all"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all appearance-none cursor-pointer"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">Linked Goal (optional)</label>
              <select
                value={form.goalId || ''}
                onChange={(e) => setForm({ ...form, goalId: e.target.value || null })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white focus:border-gold-500/30 transition-all appearance-none cursor-pointer"
              >
                <option value="">No goal linked</option>
                {goals.filter((g) => g.status === 'active').map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/50 hover:text-white/70 transition-all">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20">
                {task ? 'Save' : 'Create Task'}
              </button>
            </div>
          </form>
        </GlowCard>
      </div>
    </motion.div>
  );
}

export default function Tasks() {
  const { tasks, setTasks, today } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('today');

  const filteredTasks = useMemo(() => {
    const now = new Date(today);
    let start, end;
    switch (filter) {
      case 'today':
        start = end = today;
        break;
      case 'week': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        start = format(weekStart, 'yyyy-MM-dd');
        end = format(weekEnd, 'yyyy-MM-dd');
        break;
      }
      case 'month':
        start = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
        end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
        break;
      default:
        start = end = today;
    }
    return tasks
      .filter((t) => t.date >= start && t.date <= end)
      .sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 };
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
      });
  }, [tasks, filter, today]);

  const handleSave = (task) => {
    if (editingTask) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    } else {
      setTasks((prev) => [...prev, task]);
    }
    setShowForm(false);
    setEditingTask(null);
  };

  const handleDelete = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStatusChange = (id, status) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const statusCounts = {
    all: filteredTasks.length,
    todo: filteredTasks.filter((t) => t.status === 'todo').length,
    doing: filteredTasks.filter((t) => t.status === 'doing').length,
    done: filteredTasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold">Tasks</h1>
          <p className="text-white/40 mt-1 text-sm">{statusCounts.done}/{statusCounts.all} completed</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['today', 'week', 'month'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              filter === f
                ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                : 'bg-surface-100/50 text-white/30 border border-transparent hover:text-white/50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-4">
          <ListTodo className="w-4 h-4 text-gold-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold">
            {filter === 'today' ? "Today's Tasks" : filter === 'week' ? 'This Week' : 'This Month'}
          </h2>
          <span className="text-xs text-white/30 ml-auto">{filteredTasks.length} tasks</span>
        </div>

        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-white/30 italic py-8 text-center">No tasks found. Create one to get started.</p>
          ) : (
            filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-200/40 border border-white/[0.03] hover:bg-surface-200/60 transition-all group"
              >
                {/* Status toggle */}
                <button
                  onClick={() => {
                    const next = task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : 'todo';
                    handleStatusChange(task.id, next);
                  }}
                  className="flex-shrink-0"
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                  ) : task.status === 'doing' ? (
                    <Zap className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
                  ) : (
                    <Circle className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" strokeWidth={1.5} />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] uppercase font-medium ${PRIORITY_COLORS[task.priority] || 'text-white/30'}`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] text-white/20">{task.date}</span>
                    {task.goalId && <span className="text-[10px] text-gold-400/50">· linked</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleStatusChange(task.id, 'skipped')} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-rose-400 transition-all" title="Skip">
                    <SkipForward className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => { setEditingTask(task); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-gold-400 transition-all">
                    <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-rose-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </GlowCard>

      <AnimatePresence>
        {showForm && (
          <TaskForm
            task={editingTask}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingTask(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}




