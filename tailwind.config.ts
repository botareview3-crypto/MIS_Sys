import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Circuit-indigo: primary accent. Replaces the generic SaaS blue.
        brand: {
          50: "#eeecff",
          100: "#d9d5ff",
          200: "#b6adff",
          500: "#4f3ff0",
          600: "#4230d6",
          700: "#3624ac",
        },
        // Warm solder-orange: used sparingly, for the one bold moment (login, logo mark).
        solder: {
          500: "#ff6a3d",
          600: "#e6522a",
        },
        // Ink: dark chrome (sidebar, headers on dark).
        ink: {
          DEFAULT: "#14151f",
          soft: "#22232f",
          muted: "#8b8da3",
        },
        // Stone: warm-neutral scale replacing the default blue-grey slate,
        // used as the workspace background + hairlines throughout the app.
        stone: {
          50: "#f5f5f1",
          100: "#eeede7",
          200: "#e2e0d6",
          300: "#c9c7ba",
          400: "#a3a190",
          500: "#7a7869",
          600: "#5b5a4e",
          700: "#42413a",
          800: "#2b2a26",
          900: "#1a1a17",
        },
        // Status key: one color per repair-job status, used everywhere a
        // status appears (badges, dashboard stats, progress steps).
        status: {
          received: "#5b5d6b",
          diagnosing: "#d9910a",
          repairing: "#4f3ff0",
          ready: "#1f9d63",
          delivered: "#0f8a8b",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl: "0.875rem",
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
      },
      animation: {
        "bell-shake": "bell-shake 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
