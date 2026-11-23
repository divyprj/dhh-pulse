/**
 * PostCSS — Tailwind CSS v4 compiler bridge.
 *
 * Required infrastructure: Tailwind v4 ships as a PostCSS plugin and Next.js
 * does not register it implicitly. Without this file every `@import
 * "tailwindcss"` compiles to preflight + theme only, producing a structurally
 * broken UI (zero utilities emitted).
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
