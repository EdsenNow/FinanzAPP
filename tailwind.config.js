/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        'primary-light': 'var(--primary-light)',
        secondary: 'var(--secondary)',
        'secondary-light': 'var(--secondary-light)',
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        dark: 'var(--dark)',
        darker: 'var(--darker)',
        light: 'var(--light)',
        gray: 'var(--gray)',
        'gray-light': 'var(--gray-light)',
        'gray-dark': 'var(--gray-dark)',
        success: 'var(--success)',
        'success-light': 'var(--success-light)',
        warning: 'var(--warning)',
        'warning-light': 'var(--warning-light)',
        danger: 'var(--danger)',
        'danger-light': 'var(--danger-light)',
        'card-bg': 'var(--card-bg)',
        'card-hover': 'var(--card-hover)',
        'sidebar-bg': 'var(--sidebar-bg)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'neon-primary': '0 0 20px rgba(235, 111, 146, 0.35)',
        'neon-hover': '0 0 25px rgba(235, 111, 146, 0.50)',
        'card-dark': '0 4px 20px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};
