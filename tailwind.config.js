/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/.{js,jsx,ts,tsx}", // this makes Tailwind scan all React files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
module.exports = {
  darkMode: 'class', // This is important - it enables class-based dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}