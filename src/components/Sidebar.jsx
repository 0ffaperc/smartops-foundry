import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Target, ListTodo, RefreshCw, Brain, Bot,
  FileText, BarChart3, Settings, ChevronRight, CandlestickChart,
  GraduationCap, NotebookPen, Sparkles, Building2, Youtube,
} from 'lucide-react';
import { useApp } from '../App';

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'goals', icon: Target, label: 'Goals' },
  { id: 'tasks', icon: ListTodo, label: 'Tasks' },
  { id: 'habits', icon: RefreshCw, label: 'Habits' },
  { id: 'orchestrator', icon: Bot, label: 'Orchestrator' },
  { id: 'modelStudy', icon: GraduationCap, label: 'Model Study' },
  { id: 'backtest', icon: CandlestickChart, label: 'Backtest Journal' },
  { id: 'tradingJournal', icon: NotebookPen, label: 'Trading Journal' },
  { id: 'percJrTools', icon: Sparkles, label: 'Perc Jr. Tools' },
  { id: 'agencyOps', icon: Building2, label: 'Agency Ops' },
  { id: 'clipBuilder', icon: Youtube, label: 'Clip Builder' },
  { id: 'planner', icon: Brain, label: 'Planner' },
  { id: 'dailyReview', icon: FileText, label: 'Daily Review' },
  { id: 'weeklyReview', icon: BarChart3, label: 'Weekly Review' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { currentScreen, setCurrentScreen } = useApp();

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-[72px] lg:w-64 flex-shrink-0 bg-surface-50/80 backdrop-blur-xl border-r border-white/[0.04] flex flex-col z-20"
    >
      {/* Logo */}
      <div className="px-4 lg:px-6 h-16 flex items-center gap-3 border-b border-white/[0.04]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
          <span className="text-black font-bold text-sm">L</span>
        </div>
        <span className="hidden lg:block text-sm font-semibold tracking-wider text-white/90">
          LIFE<span className="text-gold-400">OS</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentScreen(item.id)}
              className={`w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-gold-500/10 text-gold-400 shadow-sm'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-xl bg-gold-500/8 border border-gold-500/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-4.5 h-4.5 relative z-10 flex-shrink-0" strokeWidth={1.5} />
              <span className="hidden lg:block relative z-10">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-gold-400/60 ml-auto hidden lg:block relative z-10" strokeWidth={2} />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 lg:px-4 py-4 border-t border-white/[0.04]">
        <div className="hidden lg:flex items-center gap-2 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span className="text-[11px] text-white/30 font-mono">System Online</span>
        </div>
      </div>
    </motion.aside>
  );
}




