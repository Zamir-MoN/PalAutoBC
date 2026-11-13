/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        secondary: '#111113',
        card: '#18181B',
        border: '#27272A',
        primaryText: '#FAFAFA',
        secondaryText: '#A1A1AA',
        mutedText: '#71717A',
        success: '#22C55E',
        warning: '#EAB308',
        danger: '#EF4444',
        accent: {
          DEFAULT: '#A3E635',
          hover: '#bef264',
          dark: '#65a30d',
          muted: 'rgba(163, 230, 53, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

