const config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--tc-bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--tc-surface-rgb) / <alpha-value>)",
        surface2: "rgb(var(--tc-surface-2-rgb) / <alpha-value>)",
        text: "rgb(var(--tc-text-rgb) / <alpha-value>)",
        muted: "rgb(var(--tc-text-muted-rgb) / <alpha-value>)",
        border: "rgb(var(--tc-border-rgb) / <alpha-value>)",
        primary: "rgb(var(--tc-primary-rgb) / <alpha-value>)",
        accent: "rgb(var(--tc-accent-rgb) / <alpha-value>)",
        success: "rgb(var(--tc-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--tc-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--tc-danger-rgb) / <alpha-value>)",
      },
      spacing: {
        65: "16.25rem", // 260px
      },
    },
  },
  plugins: [],
};

export default config;
