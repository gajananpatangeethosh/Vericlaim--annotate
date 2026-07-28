/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)',
        cardhover: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'flash': 'flash 1s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flash: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(59,130,246,0.45)' },
        },
      },
    },
  },
  plugins: [],
}
