import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary: Indigo scale
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Accent: Violet
        accent: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Success: Emerald
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Warning: Amber
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Danger: Rose
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        // Surface variants — dark theme (Obsidian)
        surface: {
          base:    '#0f0f13',
          raised:  '#17171e',
          overlay: '#1e1e28',
          sunken:  '#0a0a0e',
          border:  '#2a2a38',
          muted:   '#3a3a4e',
        },
        // Surface variants — light theme (Paper)
        paper: {
          base:    '#f8f7f4',
          raised:  '#ffffff',
          overlay: '#f0ede8',
          sunken:  '#e8e4dd',
          border:  '#d4cfc7',
          muted:   '#b8b3aa',
        },
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },

      boxShadow: {
        // Glow shadows using accent (violet)
        'glow-sm': '0 0 8px 0 rgba(139, 92, 246, 0.35)',
        'glow-md': '0 0 16px 0 rgba(139, 92, 246, 0.45)',
        'glow-lg': '0 0 32px 0 rgba(139, 92, 246, 0.55)',
        // Primary glow (indigo)
        'glow-primary-sm': '0 0 8px 0 rgba(99, 102, 241, 0.35)',
        'glow-primary-md': '0 0 16px 0 rgba(99, 102, 241, 0.45)',
        // Success glow
        'glow-success': '0 0 12px 0 rgba(16, 185, 129, 0.40)',
        // Danger glow
        'glow-danger': '0 0 12px 0 rgba(244, 63, 94, 0.40)',
        // General card shadow
        'card': '0 2px 8px 0 rgba(0, 0, 0, 0.32)',
        'card-hover': '0 8px 24px 0 rgba(0, 0, 0, 0.48)',
      },

      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-down': {
          '0%':   { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(1)',    opacity: '1' },
          '50%':  { transform: 'scale(1.08)', opacity: '0.7' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.8)',  opacity: '0' },
          '60%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },

      animation: {
        'slide-up':    'slide-up 0.25s ease-out',
        'slide-down':  'slide-down 0.25s ease-out',
        'fade-in':     'fade-in 0.2s ease-out',
        'scale-in':    'scale-in 0.2s ease-out',
        'pulse-ring':  'pulse-ring 1.5s ease-in-out infinite',
        'shimmer':     'shimmer 2s linear infinite',
        'bounce-in':   'bounce-in 0.35s ease-out',
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
