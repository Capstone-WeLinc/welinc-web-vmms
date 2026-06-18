/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Primary Color System
        'brand': {
          'primary': '#1a1f6e',      // Deep Indigo/Blue - primary buttons, active states, focus rings
          'dark': '#151b4f',         // Dark Blue - hover states for primary
          'black': '#0d0d0d',        // Black - text primary, dark contexts
          'danger': '#ef4444',       // Red - danger buttons, error states, critical alerts
          'warning': '#f59e0b',      // Amber - warning states
          'success': '#10b981',      // Emerald - success states, completed actions
          'surface': '#ffffff',      // White - light mode backgrounds, cards
        },
        // Status Colors
        'status': {
          'success': '#10b981',      // Emerald - Success/Active
          'info': '#3b82f6',         // Blue - Info/Scheduled
          'secondary': '#6366f1',    // Indigo - Secondary info
          'warning': '#f59e0b',      // Amber - Warning
          'caution': '#f97316',      // Orange - Caution
          'error': '#ef4444',        // Red - Error/Critical
          'pending': '#eab308',      // Yellow - Pending
          'special': '#a855f7',      // Purple - Special states (On Leave)
          'neutral': '#64748b',      // Slate - Neutral/Inactive
        },
        // Semantic Colors
        'semantic': {
          'error': '#ef4444',
          'alert': '#f59e0b',
          'success': '#10b981',
          'info': '#1a1f6e',
        },
        // Surface Palette
        'surface': {
          'light': {
            'bg': 'var(--color-surface-light-bg, #f1f5f9)',
            'card': 'var(--color-surface-light-card, #ffffff)',
            'border': 'var(--color-surface-light-border, #e2e8f0)',
            'input-bg': 'var(--color-surface-light-input-bg, #ffffff)',
            'input-border': 'var(--color-surface-light-input-border, #cbd5e1)',
            'divider': 'var(--color-surface-light-divider, #e2e8f0)',
          },
        },
      },
      backgroundColor: {
        'page': 'var(--color-page-bg, #f1f5f9)',
        'card': 'var(--color-card-bg, #ffffff)',
      },
      textColor: {
        'primary': 'var(--color-text-primary, #0d0d0d)',
        'secondary': 'var(--color-text-secondary, #64748b)',
      },
      borderColor: {
        'default': 'var(--color-border, #e2e8f0)',
      },
      borderRadius: {
        'xl': '12px',     // Standard button, card, input radius
        'full': '9999px', // Pills, badges, circular elements
      },
      boxShadow: {
        'card': '0 0 0 1px var(--color-border), 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'elevation': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'sidebar': '4px 0 24px rgba(0, 0, 0, 0.1)',
        'focus': '0 0 0 2px #1a1f6e',
      },
      outline: {
        'navy': '2px solid #1a1f6e',
      },
      transitionDuration: {
        '300': '300ms',
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
      },
    },
  },
  plugins: [
    function ({ addUtilities, theme }) {
      const colors = theme('colors');
      
      // Focus ring utilities
      addUtilities({
        '.focus-ring': {
          '@apply outline-2 outline-offset-2 outline-[#1a1f6e]': {},
        },
        '.focus-ring-inset': {
          '@apply outline-2 outline-offset-0 outline-[#1a1f6e]': {},
        },
        '.transition-theme': {
          '@apply transition-colors duration-300': {},
        },
      });
    },
  ],
}
