/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          approved: '#10b981',
          review: '#f59e0b',
          rejected: '#ef4444',
          navy: '#0f172a',
          slate: '#1e293b',
          dark: '#0b0f19',
          card: '#131b2e',
          border: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}
