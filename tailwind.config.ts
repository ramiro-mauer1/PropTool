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
        background: "var(--color-bg-base)",
        foreground: "var(--color-text-primary)",
        surface: {
          sunken: "var(--color-surface-sunken)",
          DEFAULT: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
          overlay: "var(--color-surface-overlay)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          DEFAULT: "var(--color-border)",
          hover: "var(--color-border-hover)",
        },
        accent: {
          subtle: "var(--color-accent-subtle)",
          muted: "var(--color-accent-muted)",
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
        },
        success: {
          muted: "var(--color-success-muted)",
          DEFAULT: "var(--color-success)",
        },
        error: {
          muted: "var(--color-error-muted)",
          DEFAULT: "var(--color-error)",
        },
        muted: "var(--color-text-muted)",
        secondary: "var(--color-text-secondary)",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "SF Mono",
          "JetBrains Mono",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }], // 11px
        "3xs": ["0.625rem", { lineHeight: "0.75rem" }],   // 10px
      },
      borderRadius: {
        subtle: "6px",
        card: "12px",
        panel: "16px",
      },
      spacing: {
        header: "48px",
      },
      boxShadow: {
        "subtle": "0 1px 2px 0 rgba(0, 0, 0, 0.35)",
        "card-idle": "0 0 0 1px var(--color-border), 0 2px 8px -2px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 0 0 1px var(--color-border-hover), 0 8px 24px -4px rgba(0, 0, 0, 0.6)",
        "ambient": "0 12px 36px -6px rgba(0, 0, 0, 0.7)",
        "glow": "0 0 24px -4px var(--color-accent-muted)",
        "glow-lg": "0 0 40px -8px var(--color-accent-muted)",
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        "expo-in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.23, 1, 0.32, 1) both",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
