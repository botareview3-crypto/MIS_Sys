import type { Config } from "tailwindcss";

// Dark theme (2026-11-19): the neutral `stone` scale and the tinted
// `brand-50/100/200/300/700` shades now read from CSS variables defined in
// src/app/globals.css. Light values = the original palette (unchanged);
// html[data-theme="dark"] swaps them for a charcoal palette. Class names
// everywhere in the app stay the same. Restyle the dark look by editing the
// variable values in globals.css, not here.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Cyan on navy: primary accent (chosen 2026-11-23; was purple, then teal).
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "rgb(var(--brand-700) / <alpha-value>)",
        },
        // Warm solder-orange / candy accents: used for the second and third
        // stops of gradients and for playful highlight moments.
        solder: {
          400: "#ff8a5c",
          500: "#ff6a3d",
          600: "#e6522a",
        },
        pop: {
          pink: "#ec4899",
          fuchsia: "#d946ef",
          amber: "#f59e0b",
          cyan: "#06b6d4",
          lime: "#84cc16",
        },
        // Ink: dark chrome (sidebar, headers on dark) — now a deep
        // violet-black so it reads as part of the same gradient family
        // instead of a flat neutral slab.
        ink: {
          DEFAULT: "#071225",
          soft: "#0d1c36",
          muted: "#8fb0d9",
        },
        // Stone: warm-neutral scale replacing the default blue-grey slate,
        // used as the workspace background + hairlines throughout the app.
        // Values come from CSS variables so the dark theme can flip them.
        stone: {
          50: "rgb(var(--stone-50) / <alpha-value>)",
          100: "rgb(var(--stone-100) / <alpha-value>)",
          200: "rgb(var(--stone-200) / <alpha-value>)",
          300: "rgb(var(--stone-300) / <alpha-value>)",
          400: "rgb(var(--stone-400) / <alpha-value>)",
          500: "rgb(var(--stone-500) / <alpha-value>)",
          600: "rgb(var(--stone-600) / <alpha-value>)",
          700: "rgb(var(--stone-700) / <alpha-value>)",
          800: "rgb(var(--stone-800) / <alpha-value>)",
          900: "rgb(var(--stone-900) / <alpha-value>)",
        },
        // Status key: one color per repair-job status, used everywhere a
        // status appears (badges, dashboard stats, progress steps). Bumped
        // to a brighter, more candy-saturated set so the status strip pops.
        status: {
          received: "#64748b",
          diagnosing: "#f59e0b",
          repairing: "#3b82f6",
          ready: "#10b981",
          delivered: "#06b6d4",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #ecfeff 0%, #eff6ff 50%, #f0f9ff 100%)",
        "ink-gradient": "linear-gradient(180deg, #0a1b38 0%, #071225 55%, #040b18 100%)",
        "aurora": "radial-gradient(45% 45% at 15% 10%, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0) 100%), radial-gradient(40% 40% at 85% 0%, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0) 100%), radial-gradient(50% 50% at 90% 85%, rgba(34,211,238,0.12) 0%, rgba(34,211,238,0) 100%), radial-gradient(40% 40% at 5% 90%, rgba(14,116,144,0.12) 0%, rgba(14,116,144,0) 100%)",
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(6,182,212,0.40)",
        "glow-lg": "0 20px 60px -15px rgba(6,182,212,0.45)",
        candy: "0 10px 30px -10px rgba(34,211,238,0.30)",
      },
      keyframes: {
        "bell-shake": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(-14deg)" },
          "20%": { transform: "rotate(12deg)" },
          "30%": { transform: "rotate(-10deg)" },
          "40%": { transform: "rotate(8deg)" },
          "50%": { transform: "rotate(-6deg)" },
          "60%": { transform: "rotate(4deg)" },
          "70%": { transform: "rotate(-2deg)" },
          "80%, 100%": { transform: "rotate(0deg)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(4%, -6%) scale(1.08)" },
          "66%": { transform: "translate(-3%, 4%) scale(0.95)" },
        },
        "gradient-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "bell-shake": "bell-shake 1.6s ease-in-out infinite",
        blob: "blob 14s ease-in-out infinite",
        "blob-slow": "blob 20s ease-in-out infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
        "pop-in": "pop-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
