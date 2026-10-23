/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151f32',
        },
        // Refined neutral palette (cooler grays, not yellow-warm)
        surface: {
          0:   '#ffffff',
          50:  '#f8fafc',   // page bg
          100: '#f1f5f9',   // card hover / alt bg
          200: '#e2e8f0',   // borders
          300: '#cbd5e1',   // disabled
          400: '#94a3b8',   // muted text
          500: '#64748b',   // secondary text
          600: '#475569',   // body text
          700: '#334155',   // headings
          800: '#1e293b',   // dark surface
          900: '#0f172a',   // dark bg
          950: '#020617',   // true black
        },
        // Brand — refined sky-blue
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',   // primary
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Dark mode surfaces
        dark: {
          bg:      '#0c1220',   // deeper, less purple
          surface: '#151d2e',   // slightly lighter
          card:    '#1a2332',   // card bg
          border:  '#243044',   // subtle border
          hover:   '#1f2b3d',   // hover state
        },
        // Semantic status colors
        status: {
          open:     '#10b981',   // emerald
          progress: '#f59e0b',   // amber
          closed:   '#6b7280',   // gray
          urgent:   '#ef4444',   // red
          info:     '#3b82f6',   // blue
        }
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        segoe: ['"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px — badges
      },
      borderRadius: {
        DEFAULT: '8px',    // unified corner radius
        'sm':    '6px',
        'lg':    '12px',
        'xl':    '16px',
        '2xl':   '20px',
        'pill':  '9999px',
      },
      boxShadow: {
        'xs':      '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'card':    '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'elevated':'0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'modal':   '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'glow':    '0 0 20px rgba(14, 165, 233, 0.15)',  // brand glow
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out',
        'slide-up':      'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down':    'slideDown 0.2s ease-out',
        'scale-in':      'scaleIn 0.2s ease-out',
        'shimmer':       'shimmer 2s infinite',
        'gradient-xy':   'gradient-xy 15s ease infinite',
        'blob':          'blob 7s infinite',
        'slide-in-up':   'slideInUp 0.5s ease-out',
        'confetti':      'confetti 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'gradient-xy': {
          '0%, 100%': { 'background-size': '400% 400%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' }
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' }
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(60px) rotate(720deg)', opacity: '0' },
        }
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.animation-delay-2000': {
          'animation-delay': '2s',
        },
        '.animation-delay-4000': {
          'animation-delay': '4s',
        },
      })
    }
  ],
}
