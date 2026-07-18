/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#08080f',
          50: '#0c0c14',
          100: '#111118',
          200: '#1a1a24',
          300: '#24242e',
          400: '#2e2e3a',
        },
        gold: {
          DEFAULT: '#f59e0b',
          50: '#fef3c7',
          100: '#fde68a',
          200: '#fcd34d',
          300: '#fbbf24',
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
        },
        emerald: {
          DEFAULT: '#10b981',
          400: '#34d399',
          500: '#10b981',
        },
        rose: {
          DEFAULT: '#f43f5e',
          400: '#fb7185',
        },
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          amber: '#f59e0b',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-gold': 'radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)',
        'glow-emerald': 'radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)',
        'glow-rose': 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(245,158,11,0.08)',
        'glow': '0 0 30px rgba(245,158,11,0.12)',
        'glow-lg': '0 0 50px rgba(245,158,11,0.15)',
        'glow-emerald': '0 0 30px rgba(16,185,129,0.12)',
        'card': '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
        'card-hover': '0 0 0 1px rgba(245,158,11,0.15), 0 8px 40px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
