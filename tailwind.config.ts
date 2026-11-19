import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ---- Dark theme (charcoal) ----
        // The app was written against Tailwind's light scales (slate-50 =
        // lightest ... slate-900 = darkest, white cards). Rather than touch
        // every class, the scales below are REMAPPED so the same class names
        // render dark: low numbers = dark surfaces, high numbers = light text.
        // To restyle the whole app, edit the values in this block only.
        surface: "#171a20", // cards, sidebar, inputs (was bg-white)
        slate: {
          50: "#0f1115", // page background
          100: "#1d2027", // hover rows, pills
          200: "#2b2f39", // borders
          300: "#3b4150", // input borders
          400: "#7d8497",
          500: "#9aa1b3",
          600: "#b5bbca",
          700: "#cfd4df",
          800: "#e1e4eb",
          900: "#f2f4f8", // main text
        },
        brand: {
          50: "#1a2440", // tinted backgrounds (active nav, badges)
          100: "#23305a",
          300: "#3d56a3",
          500: "#6a93ff", // focus rings
          600: "#3f6df0", // buttons / accents (white text on top)
          700: "#9db8ff", // brand-coloured text on dark
        },
        red: {
          50: "#2b1618",
          200: "#5e2428",
          600: "#f87171",
          700: "#fca5a5",
        },
        green: {
          50: "#12271c",
          700: "#86efac",
        },
        amber: {
          50: "#2b2210",
          200: "#5e4a1a",
          700: "#fcd34d",
          800: "#fde68a",
        },
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
