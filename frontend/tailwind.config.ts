import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111318",
        sand: "#F2E8D5",
        ember: "#C85C35",
        aqua: "#52D1C6",
        fog: "#E8EEF4"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(17, 19, 24, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
