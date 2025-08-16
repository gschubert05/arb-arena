/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1d4ed8" } // blue primary
      }
    }
  },
  plugins: []
}
