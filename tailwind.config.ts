import type { Config } from "tailwindcss";

// "High-Tech Precision" palette from stitch_modern_interface_kit.
// Dark navy surfaces + electric cyan primary, Space Grotesk / Inter typography.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface:                     "#051424",
        "surface-dim":               "#051424",
        "surface-bright":            "#2c3a4c",
        "surface-container-lowest":  "#010f1f",
        "surface-container-low":     "#0d1c2d",
        "surface-container":         "#122131",
        "surface-container-high":    "#1c2b3c",
        "surface-container-highest": "#273647",
        "surface-variant":           "#273647",
        "on-surface":                "#d4e4fa",
        "on-surface-variant":        "#bbc9cf",
        outline:                     "#859399",
        "outline-variant":           "#3c494e",
        background:                  "#051424",
        "on-background":             "#d4e4fa",
        primary:                     "#a4e6ff",
        "primary-container":         "#00d1ff",
        "on-primary":                "#003543",
        "on-primary-container":      "#00566a",
        "surface-tint":              "#4cd6ff",
        secondary:                   "#bec6e0",
        "secondary-container":       "#3f465c",
        tertiary:                    "#d1ddf5",
        "tertiary-container":        "#b6c1d8",
        error:                       "#ffb4ab",
        "error-container":           "#93000a",
        "on-error":                  "#690005",
        "on-error-container":        "#ffdad6",
        // Alias kept so any stray `brand-*` references still compile.
        brand: {
          50:  "#e6faff",
          500: "#4cd6ff",
          700: "#00d1ff",
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
        "glow-cyan":        "0 0 20px rgba(0, 209, 255, 0.15)",
        "glow-cyan-strong": "0 0 28px rgba(0, 209, 255, 0.35)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.6", transform: "scale(1.15)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
