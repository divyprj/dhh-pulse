# Design Philosophy and Visual Tokens

## 1. Design Direction: Studio Hardware Console

DHH Pulse rejects generic Software-as-a-Service visual patterns in favor of a specialized aesthetic derived from analog audio mastering consoles, studio outboard gear, and precision laboratory telemetry.

### Anti-Generic Design Rules
- **No Centered Hero Headlines:** All headers are left-aligned, set with uppercase tracking-spaced eyebrows (`uppercase tracking-[0.16em]`).
- **No Floating SaaS Cards:** Interface structures use full-bleed console panels (`.console`), recessed deck backgrounds (`.panel`), and tabular rows.
- **No Purple/Blue SaaS Gradients:** Color usage is restricted to void-black substrates, steel hairline dividers, and warm signal amber indicators.
- **No Generic System Font Stacks:** Typography uses calibrated pairings of Inter (sans) and JetBrains Mono (mono) with explicit OpenType stylistic sets.

---

## 2. Color Palette and Design Tokens

Extracted directly from `tailwind.config.ts` and `src/app/globals.css`:

| Token | CSS Variable | Hex Value | Role |
|---|---|---|---|
| `void` | `--void` | `#08080a` | Deepest substrate background applied to `<html>`. |
| `pitch` | `--pitch` | `#0b0b0e` | Primary viewport background applied to `<body>`. |
| `deck` | `--deck` | `#101014` | Recessed container panels, card substrates, header bars. |
| `riser` | `--riser` | `#17171c` | Active table rows, elevated hover states. |
| `hairline`| `--hairline`| `#26262d` | 1px precision structural borders and grid separators. |
| `chalk` | `--chalk` | `#f2f2ef` | Primary high-contrast text, major headings, numerical figures. |
| `ash` | `--ash` | `#a2a2ab` | Secondary text, table headers, descriptive metadata. |
| `dim` | `--dim` | `#7e7e88` | Inactive icons, timestamps, secondary labels. |
| `signal` | `--signal` | `#ffb020` | Warm amber accent for keyboard focus rings and active tabs. |
| `gain` | `--gain` | `#34d399` | Emerald green for positive stream deltas and audience increases. |
| `loss` | `--loss` | `#fb7185` | Rose red for negative listener deltas and audience decreases. |

---

## 3. Typography and Numerical Styling

- **Primary Sans:** Inter (`var(--font-sans)`). Applied to titles, navigation, and body copy.
  - Enabled OpenType Features: `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`
- **Monospace:** JetBrains Mono (`var(--font-mono)`). Applied to all statistics, playcounts, timestamps, ranks, and badges.
  - Enforced Tabular Figures: `font-variant-numeric: tabular-nums` prevents jitter during data updates and ensures strict columnar alignment in tables.

---

## 4. Spacing, Borders, and Radii

- **Border Width:** Fixed 1px hairline width (`border border-hairline`).
- **Corner Radii:** Micro-radii of 3px (`rounded-[3px]`) for panels, tables, and buttons, maintaining an industrial, manufactured aesthetic.
- **Focus Rings:** High-visibility 2px solid amber ring (`outline: 2px solid var(--signal)`) with a 2px offset.
