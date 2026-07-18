import React from 'react';
import { motion } from 'framer-motion';

export default function GlowCard({
  children,
  className = '',
  glowColor = 'gold',
  padding = true,
  onClick,
  as: Component = motion.div,
  ...props
}) {
  const glowMap = {
    gold: 'from-gold-500/10 via-transparent to-transparent',
    emerald: 'from-emerald-500/10 via-transparent to-transparent',
    rose: 'from-rose-500/8 via-transparent to-transparent',
    blue: 'from-accent-blue/10 via-transparent to-transparent',
    purple: 'from-accent-purple/10 via-transparent to-transparent',
  };

  return (
    <Component
      whileHover={onClick ? { y: -2, scale: 1.005 } : {}}
      whileTap={onClick ? { scale: 0.995 } : {}}
      onClick={onClick}
      className={`relative rounded-2xl bg-surface-100/90 border border-white/[0.05] shadow-card overflow-hidden group transition-all duration-300
        ${onClick ? 'cursor-pointer hover:shadow-card-hover' : ''}
        ${padding ? 'p-4 lg:p-5' : ''}
        ${className}`}
      {...props}
    >
      {/* Glow overlay */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-radial ${glowMap[glowColor] || glowMap.gold} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.08)',
        }}
      />

      <div className="relative z-10">
        {children}
      </div>
    </Component>
  );
}




