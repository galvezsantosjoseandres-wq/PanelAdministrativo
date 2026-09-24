/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/index.html", "./app/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      colors: {
        // Paleta tomada de la maqueta (sidebar azul marino, acento dorado).
        panel: {
          navy: "#0f1b2e",
          navyLight: "#16263f",
          gold: "#c9a04a",
        },
      },
    },
  },
  plugins: [],
};
