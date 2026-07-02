import type { Config } from "tailwindcss";

// "Calm Relief" light palette — soft blue-gray surfaces + a readable teal accent,
// tuned for a humanitarian/NGO interface. Space Grotesk / Inter typography.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface:                     "#f5f8fc",
        "surface-dim":               "#e9eef5",
        "surface-bright":            "#ffffff",
        "surface-container-lowest":  "#ffffff",
        "surface-container-low":     "#ffffff",
        "surface-container":         "#f1f5fa",
        "surface-container-high":    "#e9eef5",
        "surface-container-highest": "#dfe6ef",
        "surface-variant":           "#e2e8f0",
        "on-surface":                "#15212e",
        "on-surface-variant":        "#566472",
        outline:                     "#94a3b8",
        "outline-variant":           "#cbd5e1",
        background:                  "#f5f8fc",
        "on-background":             "#15212e",
        primary:                     "#0e7490",
        "primary-container":         "#0891b2",
        "on-primary":                "#ffffff",
        "on-primary-container":      "#ffffff",
        "surface-tint":              "#0e7490",
        secondary:                   "#475569",
        "secondary-container":       "#e2e8f0",
        tertiary:                    "#334155",
        "tertiary-container":        "#e2e8f0",
        error:                       "#dc2626",
        "error-container":           "#fee2e2",
        "on-error":                  "#ffffff",
        "on-error-container":        "#7f1d1d",
        // Alias kept so any stray `brand-*` references still compile.
        brand: {
          50:  "#ecfeff",
          500: "#0891b2",
          700: "#0e7490",
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', "ui-sans-serif", "system-ui"],
        body:    ["Inter", "ui-sans-serif", "system-ui"],
        mono:    ['"Space Grotesk"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "600" }],
        "mono-data":  ["14px", { lineHeight: "1", letterSpacing: "0",     fontWeight: "500" }],
      },
      spacing: {
        gutter:          "24px",
        margin:          "32px",
        "section-gap":   "80px",
        "container-max": "1280px",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        "glow-cyan":        "0 1px 2px rgba(15, 33, 46, 0.06), 0 0 0 3px rgba(8, 145, 178, 0.12)",
        "glow-cyan-strong": "0 4px 14px rgba(8, 145, 178, 0.30)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.6", transform: "scale(1.15)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%":      { transform: "translate(28px, -22px) scale(1.12)" },
          "66%":      { transform: "translate(-24px, 18px) scale(0.94)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
        radar: {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        equalize: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%":      { transform: "scaleY(1)" },
        },
      },
      animation: {
        "pulse-dot":   "pulse-dot 1.8s ease-in-out infinite",
        float:         "float 6s ease-in-out infinite",
        "float-slow":  "float 9s ease-in-out infinite",
        aurora:        "aurora 18s ease-in-out infinite",
        "aurora-slow": "aurora 26s ease-in-out infinite",
        "fade-in-up":  "fade-in-up 0.7s cubic-bezier(0.21, 0.6, 0.35, 1) both",
        shimmer:       "shimmer 3.5s linear infinite",
        marquee:       "marquee 32s linear infinite",
        radar:         "radar 14s linear infinite",
        equalize:      "equalize 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
