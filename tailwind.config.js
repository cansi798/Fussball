/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warmes, freundliches, kindgerechtes Farbschema
        pitch: { 50: '#f0fdf4', 500: '#16a34a', 600: '#15803d', 700: '#166534' },
        sun: { 400: '#fbbf24', 500: '#f59e0b' },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
