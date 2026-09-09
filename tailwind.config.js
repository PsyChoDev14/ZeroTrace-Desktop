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
          bg: "rgb(var(--zt-bg) / <alpha-value>)",
          "bg-elevated": "rgb(var(--zt-bg-elevated) / <alpha-value>)",
          surface: "rgb(var(--zt-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--zt-surface-2) / <alpha-value>)",
          border: "rgb(var(--zt-border) / <alpha-value>)",
          "border-strong": "rgb(var(--zt-border-strong) / <alpha-value>)",
          track: "var(--zt-track)",
          text: "rgb(var(--zt-text) / <alpha-value>)",
          "text-muted": "rgb(var(--zt-text-muted) / <alpha-value>)",
          "text-faint": "rgb(var(--zt-text-faint) / <alpha-value>)",
          accent: "rgb(var(--zt-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--zt-accent-hover) / <alpha-value>)",
          "accent-soft": "var(--zt-accent-soft)",
          "accent-ring": "var(--zt-accent-ring)",
          success: "rgb(var(--zt-success) / <alpha-value>)",
          "success-soft": "var(--zt-success-soft)",
          warn: "rgb(var(--zt-warn) / <alpha-value>)",
          "warn-soft": "var(--zt-warn-soft)",
          danger: "rgb(var(--zt-danger) / <alpha-value>)",
          "danger-soft": "var(--zt-danger-soft)",
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
