/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["'Scheherazade New'", "'Noto Naskh Arabic'", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          700: "#1d4ed8",
        },
      },
    },
  },
  plugins: [],
};
