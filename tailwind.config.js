/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Preflight desactivado para NO romper el CSS de las vistas que aún no migras.
  // (el borde de Tailwind se arregla con una regla en index.css)
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          glow: "rgba(249, 115, 22, 0.25)",
        },
        dark: {
          base: "#080C15",
          sidebar: "#0A0F1A",
          surface: "#0E1524",
          card: "#121B2F",
          cardHover: "#16223B",
          border: "rgba(255, 255, 255, 0.07)",
          borderFocus: "rgba(249, 115, 22, 0.45)",
        },
      },
      keyframes: {
        fadeSlideIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        card: "fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};