/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fffaf8',
          100: '#f7eeea',
          200: '#dfc1cb',
          300: '#d7b0a0',
          400: '#af8f7e',
          500: '#a7816d',
          600: '#b66681',
          700: '#8f5f4c',
          800: '#62473a',
          900: '#4a372c',
        },
      },
      boxShadow: {
        soft: '0 6px 20px rgba(90, 57, 49, 0.08)',
      },
    },
  },
  plugins: [],
}

