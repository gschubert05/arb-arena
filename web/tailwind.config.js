/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1d4ed8" },
      },
    },
  },
  plugins: [],
};
