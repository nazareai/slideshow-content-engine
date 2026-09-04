/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f5f0',
        ink: '#171717',
        cobalt: '#2457ff',
        coral: '#ff654a',
        moss: '#d9edc2'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'ui-serif', 'serif']
      }
    }
  },
  plugins: []
}
