import React from 'react';
import { motion } from 'framer-motion';

export default function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'gold',
  glow = false,
  onClick,
  className = '',
}) {
  const colorMap = {
    gold: { from: 'from-gold-400', to: 'to-gold-600', bg: 'bg-gold-500/10', text: 'text-gold-400', border: 'border-gold-500/20', glow: 'shadow-glow' },
    emerald: { from: 'from-emerald-400', to: 'to-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-glow-emerald' },
    rose: { from: 'from-rose-400', to: 'to-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', glow: '' },
    blue: { from: 'from-accent-blue', to: 'to-accent-blue/80', bg: 'bg-accent-blue/10', text: 'text-accent-blue', border: 'border-accent-blue/20', glow: '' },
    purple: { from: 'from-accent-purple', to: 'to-accent-purple/80', bg: 'bg-accent-purple/10', text: 'text-accent-purple', border: 'border-accent-purple/20', glow: '' },
  };

  const c = colorMap[color] || colorMap.gold;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`relative p-4 lg:p-5 rounded-2xl bg-surface-100/80 border ${c.border} ${glow ? c.glow : 'shadow-card'} transition-all duration-300 cursor-pointer group ${className}`}
    >
      {glow && (
        <div className={`absolute inset-0 rounded-2xl bg-gradient-radial from-gold-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      )}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[11px] uppercase tracking-widest text-white/30 font-medium">{label}</span>
          {Icon && (
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
              <Icon className={`w-4.5 h-4.5 ${c.text}`} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl lg:text-3xl font-bold bg-gradient-to-br ${c.from} ${c.to} bg-clip-text text-transparent`}>
            {value}
          </span>
          {trend !== undefined && (
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-white/30 mt-1">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}




