const config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        65: "16.25rem", // 260px
      },
    },
  },
  plugins: [],
};

export default config;
