import { v4 as uuidv4 } from 'uuid';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';

const STORAGE_KEY = 'lifeos_data';

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load data:', e);
  }
  return null;
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save data:', e);
  }
}

// Goal helpers
export function createGoal({ parentId = null, level, title, targetResult = '', deadline = '', status = 'active' }) {
  return {
    id: uuidv4(),
    parentId,
    level,
    title,
    targetResult,
    deadline,
    status,
    createdAt: format(new Date(), 'yyyy-MM-dd'),
  };
}

// Task helpers
export function createTask({ goalId = null, title, date, priority = 'medium', status = 'todo' }) {
  return {
    id: uuidv4(),
    goalId,
    title,
    date,
    priority,
    status,
    createdAt: format(new Date(), 'yyyy-MM-dd'),
  };
}

// Habit helpers
export function createHabit({ name, type = 'good', active = true }) {
  return {
    id: uuidv4(),
    name,
    type,
    active,
    createdAt: format(new Date(), 'yyyy-MM-dd'),
  };
}

// Habit Log helpers
export function createHabitLog(habitId, date) {
  return {
    id: uuidv4(),
    habitId,
    date,
    completed: true,
  };
}

// Review helpers
export function createReview({ mood, energy, wins, mistakes, notes, tomorrowFocus }) {
  return {
    id: uuidv4(),
    date: format(new Date(), 'yyyy-MM-dd'),
    mood,
    energy,
    wins,
    mistakes,
    notes,
    tomorrowFocus,
    aiSummary: '',
  };
}

// Date helpers for filtering
export function getDateRange(period, referenceDate = new Date()) {
  const ref = referenceDate;
  switch (period) {
    case 'today':
      return { start: format(ref, 'yyyy-MM-dd'), end: format(ref, 'yyyy-MM-dd') };
    case 'week':
      return { start: format(startOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    case 'month':
      return { start: format(startOfMonth(ref), 'yyyy-MM-dd'), end: format(endOfMonth(ref), 'yyyy-MM-dd') };
    case 'quarter':
      return { start: format(startOfQuarter(ref), 'yyyy-MM-dd'), end: format(endOfQuarter(ref), 'yyyy-MM-dd') };
    case 'year':
      return { start: format(startOfYear(ref), 'yyyy-MM-dd'), end: format(endOfYear(ref), 'yyyy-MM-dd') };
    default:
      return { start: format(ref, 'yyyy-MM-dd'), end: format(ref, 'yyyy-MM-dd') };
  }
}

export function filterTasksByDate(tasks, dateStr) {
  return tasks.filter((t) => t.date === dateStr);
}

export function filterTasksByRange(tasks, startDate, endDate) {
  return tasks.filter((t) => t.date >= startDate && t.date <= endDate);
}

export function getHabitLogsForDate(habitLogs, dateStr) {
  return habitLogs.filter((l) => l.date === dateStr);
}

export function getHabitStreak(habitLogs, habitId, upToDate = format(new Date(), 'yyyy-MM-dd')) {
  const logs = habitLogs
    .filter((l) => l.habitId === habitId && l.completed)
    .map((l) => l.date)
    .sort()
    .reverse();

  if (logs.length === 0) return 0;

  let streak = 0;
  const current = parseISO(upToDate);
  let checkDate = current;

  for (let i = 0; i < logs.length; i++) {
    const logDate = parseISO(logs[i]);
    const diff = Math.round((checkDate - logDate) / (1000 * 60 * 60 * 24));
    if (diff === streak) {
      streak++;
      checkDate = new Date(current.getTime() - streak * 24 * 60 * 60 * 1000);
    } else if (diff > streak) {
      break;
    }
  }

  return streak;
}

export function exportData() {
  return localStorage.getItem(STORAGE_KEY);
}

export function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;
    localStorage.setItem(STORAGE_KEY, jsonStr);
    return true;
  } catch {
    return false;
  }
}

// Compute daily score
export function computeDailyScore(tasks, habits, habitLogs, reviews, dateStr) {
  const tasksToday = tasks.filter((t) => t.date === dateStr);
  const tasksDone = tasksToday.filter((t) => t.status === 'done').length;
  const tasksTotal = tasksToday.length || 1;
  const taskScore = (tasksDone / tasksTotal) * 40;

  const activeHabits = habits.filter((h) => h.active);
  const loggedHabits = habitLogs.filter((l) => l.date === dateStr && l.completed);
  const goodHabits = activeHabits.filter((h) => h.type === 'good');
  const goodLogged = goodHabits.filter((h) => loggedHabits.some((l) => l.habitId === h.id)).length;
  const goodTotal = goodHabits.length || 1;
  const habitScore = (goodLogged / goodTotal) * 30;

  const badHabits = activeHabits.filter((h) => h.type === 'bad');
  const badAvoided = badHabits.filter((h) => loggedHabits.some((l) => l.habitId === h.id)).length;
  const badTotal = badHabits.length || 1;
  const badScore = (badAvoided / badTotal) * 30;

  const todayReview = reviews.find((r) => r.date === dateStr);
  const reviewBonus = todayReview ? 5 : 0;

  return Math.round(taskScore + habitScore + badScore + reviewBonus);
}




