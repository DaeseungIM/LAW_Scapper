/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bkl: {
          navy: '#002C5F',
          'navy-light': '#003a7d',
          gray: '#F8F9FA',
          'gray-dark': '#4A4A4A',
          border: '#E2E8F0',
        }
      }
    },
  },
  plugins: [],
}
