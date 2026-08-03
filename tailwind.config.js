/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7B55A8',
          'purple-dark': '#4A2D7A',
          'purple-light': '#C9A8E0',
          'purple-pale': '#EDE0F7',
          yellow: '#F5D657',
          'yellow-light': '#FDF3C0',
          bg: '#FAF7FF',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        display: ['Bubblegum Sans', 'cursive'],
      },
    },
  },
  plugins: [],
}
