import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './screens/Dashboard';
import Goals from './screens/Goals';
import Tasks from './screens/Tasks';
import Habits from './screens/Habits';
import Planner from './screens/Planner';
import Orchestrator from './screens/Orchestrator';
import BacktestJournal from './screens/BacktestJournal';
import ModelStudy from './screens/ModelStudy';
import TradingJournal from './screens/TradingJournal';
import PercJrTools from './screens/PercJrTools';
import AgencyOps from './screens/AgencyOps';
import PilotAutomation from './screens/PilotAutomation';
import ClipBuilder from './screens/ClipBuilder';
import DailyReview from './screens/DailyReview';
import WeeklyReview from './screens/WeeklyReview';
import Settings from './screens/Settings';

export const AppContext = createContext();

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContext.Provider');
  return ctx;
};

const SCREENS = {
  dashboard: { component: Dashboard, label: 'Dashboard', icon: 'LayoutDashboard' },
  goals: { component: Goals, label: 'Goals', icon: 'Target' },
  tasks: { component: Tasks, label: 'Tasks', icon: 'ListTodo' },
  habits: { component: Habits, label: 'Habits', icon: 'RefreshCw' },
  orchestrator: { component: Orchestrator, label: 'Orchestrator', icon: 'Bot' },
  modelStudy: { component: ModelStudy, label: 'Model Study', icon: 'GraduationCap' },
  backtest: { component: BacktestJournal, label: 'Backtest Journal', icon: 'CandlestickChart' },
  tradingJournal: { component: TradingJournal, label: 'Trading Journal', icon: 'NotebookPen' },
  percJrTools: { component: PercJrTools, label: 'Perc Jr. Tools', icon: 'Sparkles' },
  agencyOps: { component: AgencyOps, label: 'Agency Ops', icon: 'Building2' },
  pilotAutomation: { component: PilotAutomation, label: 'Automation Pilot', icon: 'Zap' },
  clipBuilder: { component: ClipBuilder, label: 'Clip Builder', icon: 'Youtube' },
  planner: { component: Planner, label: 'Planner', icon: 'Brain' },
  dailyReview: { component: DailyReview, label: 'Daily Review', icon: 'FileText' },
  weeklyReview: { component: WeeklyReview, label: 'Weekly Review', icon: 'BarChart3' },
  settings: { component: Settings, label: 'Settings', icon: 'Settings' },
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [plannerProfile, setPlannerProfile] = useState(null);
  const [settings, setSettings] = useState({
    dailyReviewModel: 'deepseek/deepseek-v4-flash',
    plannerModel: 'anthropic/claude-haiku-4.5',
    criticModel: 'anthropic/claude-haiku-4.5',
    premiumModel: 'anthropic/claude-haiku-4.5',
    orchestratorModel: 'anthropic/claude-haiku-4.5',
    apiKey: '',
    theme: 'dark',
  });

  // Initialize with sample data if empty
  useEffect(() => {
    if (!data) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStr = weekStart.toISOString().split('T')[0];

      const sampleGoals = [
        { id: 'g1', parentId: null, level: 'year', title: 'Become a Senior Architect', targetResult: 'Lead major system design decisions', deadline: '2026-12-31', status: 'active', createdAt: '2026-01-01' },
        { id: 'g2', parentId: 'g1', level: 'quarter', title: 'Ship LifeOS V2', targetResult: 'Complete the full LifeOS V2 rewrite', deadline: '2026-06-30', status: 'active', createdAt: '2026-03-01' },
        { id: 'g3', parentId: 'g2', level: 'month', title: 'Build Core Features', targetResult: 'All screens functional with data persistence', deadline: '2026-04-30', status: 'active', createdAt: '2026-03-15' },
        { id: 'g4', parentId: 'g3', level: 'week', title: 'Complete Dashboard & Goals', targetResult: 'Dashboard and Goals screens fully polished', deadline: weekStr, status: 'active', createdAt: '2026-04-01' },
        { id: 'g5', parentId: 'g4', level: 'day', title: 'Polish Dashboard UI', targetResult: 'Dashboard looks premium and complete', deadline: today, status: 'active', createdAt: '2026-04-10' },
        { id: 'g6', parentId: null, level: 'year', title: 'Achieve Financial Freedom', targetResult: 'Build multiple income streams', deadline: '2026-12-31', status: 'active', createdAt: '2026-01-01' },
      ];

      const sampleTasks = [
        { id: 't1', goalId: 'g4', title: 'Design dashboard layout', date: today, priority: 'high', status: 'done', createdAt: '2026-04-10' },
        { id: 't2', goalId: 'g4', title: 'Implement goal tree view', date: today, priority: 'high', status: 'doing', createdAt: '2026-04-10' },
        { id: 't3', goalId: 'g5', title: 'Polish glow card animations', date: today, priority: 'medium', status: 'todo', createdAt: '2026-04-10' },
        { id: 't4', goalId: null, title: 'Morning journal entry', date: today, priority: 'low', status: 'done', createdAt: '2026-04-10' },
        { id: 't5', goalId: null, title: 'Review weekly progress', date: today, priority: 'medium', status: 'todo', createdAt: '2026-04-10' },
        { id: 't6', goalId: 'g2', title: 'Plan Q2 deliverables', date: weekStr, priority: 'high', status: 'todo', createdAt: '2026-04-08' },
      ];

      const sampleHabits = [
        { id: 'h1', name: 'Morning meditation', type: 'good', active: true, createdAt: '2026-01-15' },
        { id: 'h2', name: 'Read 30 minutes', type: 'good', active: true, createdAt: '2026-01-15' },
        { id: 'h3', name: 'Exercise', type: 'good', active: true, createdAt: '2026-01-15' },
        { id: 'h4', name: 'Write in journal', type: 'good', active: true, createdAt: '2026-01-15' },
        { id: 'h5', name: 'Social media doom scrolling', type: 'bad', active: true, createdAt: '2026-01-15' },
        { id: 'h6', name: 'Skipping meals', type: 'bad', active: true, createdAt: '2026-01-15' },
        { id: 'h7', name: 'Procrastinating on hard tasks', type: 'bad', active: true, createdAt: '2026-01-15' },
      ];

      const sampleHabitLogs = [];
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        last7Days.push(ds);
      }
      last7Days.forEach((ds) => {
        sampleHabits.forEach((h) => {
          if (h.active && Math.random() > 0.3) {
            sampleHabitLogs.push({
              id: `hl-${h.id}-${ds}`,
              habitId: h.id,
              date: ds,
              completed: true,
            });
          }
        });
      });

      const sampleReviews = [
        {
          id: 'r1',
          date: today,
          mood: 8,
          energy: 7,
          wins: 'Completed dashboard layout, started goal tree view',
          mistakes: 'Spent too long on animations',
          notes: 'Good focus day overall. Need to stay disciplined.',
          tomorrowFocus: 'Finish goal tree and start planner screen',
          aiSummary: '',
        },
      ];

      const samplePlannerProfile = {
        wakeTime: '06:30',
        sleepTime: '22:30',
        fixedCommitments: 'Team standup 9-9:30, Dentist 14:00-15:00',
        deepWorkHours: 4,
        scheduleConstraints: 'No meetings after 16:00',
        habitsFocus: 'meditation, reading',
        badHabitsToAvoid: 'social media scrolling',
      };

      setGoals(sampleGoals);
      setTasks(sampleTasks);
      setHabits(sampleHabits);
      setHabitLogs(sampleHabitLogs);
      setReviews(sampleReviews);
      setPlannerProfile(samplePlannerProfile);
    } else {
      setGoals(data.goals || []);
      setTasks(data.tasks || []);
      setHabits(data.habits || []);
      setHabitLogs(data.habitLogs || []);
      setReviews(data.reviews || []);
      setPlannerProfile(data.plannerProfile || null);
      if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (goals.length === 0 && tasks.length === 0 && habits.length === 0) return;
    const payload = { goals, tasks, habits, habitLogs, reviews, plannerProfile, settings };
    localStorage.setItem('lifeos_data', JSON.stringify(payload));
  }, [goals, tasks, habits, habitLogs, reviews, plannerProfile, settings]);

  const ActiveScreen = SCREENS[currentScreen]?.component || Dashboard;

  const contextValue = useMemo(() => ({
    currentScreen,
    setCurrentScreen,
    goals, setGoals,
    tasks, setTasks,
    habits, setHabits,
    habitLogs, setHabitLogs,
    reviews, setReviews,
    plannerProfile, setPlannerProfile,
    settings, setSettings,
    today: new Date().toISOString().split('T')[0],
    screens: SCREENS,
  }), [currentScreen, goals, tasks, habits, habitLogs, reviews, plannerProfile, settings]);

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto scrollable relative">
          <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
          <div className="relative z-10 min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="p-6 lg:p-8 max-w-7xl mx-auto"
              >
                <ActiveScreen />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}





