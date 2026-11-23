import type { Config } from "tailwindcss";

/**
 * DHH Pulse — Design Tokens
 *
 * Studio-console palette: near-black decks, hairline steel borders, amber
 * signal light, emerald/rose for movement. No SaaS gradients, no purple.
 *
 * Loaded by `src/app/globals.css` through `@config`. Raw CSS mirrors these
 * values in `:root` so hand-authored primitives stay in lockstep.
 */
const config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /** Deepest layer — page substrate */
        void: "#08080A",
        /** Page background */
        pitch: "#0B0B0E",
        /** Panel / section surface */
        deck: "#101014",
        /** Raised row, input, pressed surface */
        riser: "#17171C",
        /** Hairline border — steel, not gray */
        hairline: "#26262D",
        /** Primary type */
        chalk: "#F2F2EF",
        /** Secondary type */
        ash: "#A2A2AB",
        /** Tertiary type / labels */
        dim: "#7E7E88",
        /** Signal amber — brand accent, active states */
        signal: "#FFB020",
        /** Positive movement */
        gain: "#34D399",
        /** Negative movement */
        loss: "#FB7185",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        /** Hero metric — the number that owns the page */
        display: [
          "clamp(2.75rem, 6vw, 4.5rem)",
          { lineHeight: "0.9", letterSpacing: "-0.045em", fontWeight: "600" },
        ],
        /** Section metric */
        metric: [
          "clamp(1.75rem, 3vw, 2.5rem)",
          { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" },
        ],
        /** Micro label */
        label: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.14em" }],
      },
      spacing: {
        /** Layout rhythm additions */
        rail: "15rem",
        gut: "1.25rem",
        row: "3.25rem",
      },
      borderRadius: {
        /** Industrial: corners are cut, never squishy */
        card: "3px",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(8px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        sweep: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
      },
      animation: {
        rise: "rise 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        sweep: "sweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
} satisfies Config;

export default config;
