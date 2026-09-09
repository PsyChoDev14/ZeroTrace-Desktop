/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zt: {
          bg: "#08080A",
          "bg-elevated": "#0E0E11",
          surface: "#141417",
          "surface-2": "#1B1B20",
          border: "#26262C",
          "border-strong": "#33333B",
          track: "rgba(255, 255, 255, 0.07)",
          text: "#F4F4F6",
          "text-muted": "#8C8C97",
          "text-faint": "#5C5C66",
          accent: "#5468FF",
          "accent-hover": "#6A7BFF",
          "accent-soft": "rgba(84, 104, 255, 0.14)",
          "accent-ring": "rgba(84, 104, 255, 0.32)",
          success: "#35C77B",
          "success-soft": "rgba(53, 199, 123, 0.14)",
          warn: "#E5A33C",
          "warn-soft": "rgba(229, 163, 60, 0.14)",
          danger: "#F0533D",
          "danger-soft": "rgba(240, 83, 61, 0.14)",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      }
    },
  },
  plugins: [],
}
