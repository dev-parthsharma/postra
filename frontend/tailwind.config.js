// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",  // ← enables .dark class on <html> to trigger dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};