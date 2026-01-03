/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0b',
        foreground: '#fafafa',
        card: '#141416',
        'card-foreground': '#fafafa',
        primary: '#3b82f6',
        'primary-foreground': '#fafafa',
        secondary: '#27272a',
        'secondary-foreground': '#a1a1aa',
        muted: '#18181b',
        'muted-foreground': '#71717a',
        accent: '#22c55e',
        'accent-foreground': '#fafafa',
        destructive: '#ef4444',
        'destructive-foreground': '#fafafa',
        border: '#27272a',
        input: '#27272a',
        ring: '#3b82f6',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-recording': 'pulse-recording 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-recording': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

