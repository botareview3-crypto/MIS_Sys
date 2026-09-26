import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          500: "#2f5fe0",
          600: "#2549b8",
          700: "#1c3a91",
        },
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
