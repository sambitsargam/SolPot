import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        bg: {
          primary: "#06080d",
          secondary: "#0c0f18",
          card: "#111624",
          elevated: "#171d30",
        },
        accent: {
          purple: "#8b5cf6",
          violet: "#a78bfa",
          cyan: "#06b6d4",
          teal: "#14b8a6",
          green: "#10b981",
          lime: "#84cc16",
          amber: "#f59e0b",
        },
        border: {
          DEFAULT: "#1e2740",
          light: "#2a3555",
          focus: "#8b5cf6",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#64748b",
          dim: "#475569",
        },
        // Keep solana- prefix for existing component compatibility
        solana: {
          purple: "#8b5cf6",
          green: "#10b981",
          dark: "#0c0f18",
          card: "#111624",
          border: "#1e2740",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        "float-slow": "float 8s ease-in-out 1s infinite",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "spin-slow": "spin 12s linear infinite",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "fade-up-delayed": "fade-up 0.6s ease-out 0.15s forwards",
        "scale-in": "scale-in 0.5s ease-out forwards",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #8b5cf6, 0 0 10px #8b5cf6" },
          "100%": { boxShadow: "0 0 20px #06b6d4, 0 0 30px #06b6d4" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,92,246,0.03) 1px, transparent 1px)",
        "radial-hero":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.15), transparent)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
    },
  },
  plugins: [],
};

export default config;
