import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 6,
  color = '#f59e0b',
  bgColor = 'rgba(255,255,255,0.06)',
  label,
  value,
  animated = true,
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animated ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {children || (
            <span className="text-lg font-bold">
              {value !== undefined ? value : `${Math.round(progress)}%`}
            </span>
          )}
        </div>
      </div>
      {label && (
        <span className="text-xs text-white/40 font-medium">{label}</span>
      )}
    </div>
  );
}




