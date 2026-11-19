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
        // Circuit-indigo: primary accent. Replaces the generic SaaS blue.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "#8a5cff",
          500: "#7c3aed",
          600: "#6b21d8",
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
          DEFAULT: "#170f2e",
          soft: "#241a42",
          muted: "#a79bd1",
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
          repairing: "#7c3aed",
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
        "brand-gradient": "linear-gradient(135deg, #7c3aed 0%, #d946ef 50%, #ff6a3d 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #f2efff 0%, #ffe4f5 50%, #ffedd9 100%)",
        "ink-gradient": "linear-gradient(180deg, #1e1240 0%, #170f2e 55%, #240f33 100%)",
        "aurora": "radial-gradient(45% 45% at 15% 10%, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0) 100%), radial-gradient(40% 40% at 85% 0%, rgba(236,72,153,0.18) 0%, rgba(236,72,153,0) 100%), radial-gradient(50% 50% at 90% 85%, rgba(6,182,212,0.16) 0%, rgba(6,182,212,0) 100%), radial-gradient(40% 40% at 5% 90%, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 100%)",
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(124,58,237,0.45)",
        "glow-lg": "0 20px 60px -15px rgba(124,58,237,0.5)",
        candy: "0 10px 30px -10px rgba(217,70,239,0.35)",
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
