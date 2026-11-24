# DHH Pulse — Frontend Craft & Design Engineering Guide

The DHH Pulse user interface is engineered according to the **Frontend Craft Triad** (`AGENTS.md`), synthesizing the design philosophies of **Taste Skill** (Art Direction & Anti-Slop), **Impeccable** (UX Architecture & Systems Craft), and **Emil Kowalski** (Design Engineering & Motion Physics).

---

## 1. Visual Philosophy & Art Direction (Taste-Skill)

### Anti-Generic AI Directives
DHH Pulse strictly eliminates common generative AI interface clichés:
- ❌ **No Centered Hero Headlines:** Headings are left-aligned with uppercase tracking-spaced eyebrows (`uppercase tracking-[0.16em]`).
- ❌ **No Generic 3-Column SaaS Cards:** Layouts utilize full-width modular console strips (`.console`), recessed panels (`.panel`), and dense data tables.
- ❌ **No Purple/Blue SaaS Gradient Blobs:** The color palette is rooted in physical hardware mastering consoles, recording studios, and analog audio gear.
- ❌ **No Default Font Stacks:** Disciplined pairings of Inter (sans) and JetBrains Mono (mono) with calibrated OpenType features (`cv02`, `cv03`, `cv04`, `cv11`).

### Color Palette & Design Tokens

| Token | Hex Value | Semantic Role |
|---|---|---|
| `void` | `#08080a` | Deepest background substrate (`<html>`). |
| `pitch` | `#0b0b0e` | Primary viewport background (`<body>`). |
| `deck` | `#101014` | Recessed container panels, card substrates, header bars. |
| `riser` | `#17171c` | Hover highlights, active interactive backgrounds. |
| `hairline`| `#26262d` | 1px structural grid dividers and precision borders. |
| `chalk` | `#f2f2ef` | High-contrast primary text, headlines, table numbers. |
| `ash` | `#a2a2ab` | Secondary labels, descriptions, subheaders. |
| `dim` | `#7e7e88` | Metadata, timestamps, inactive icons. |
| `signal`| `#ffb020` | Amber indicator accent, keyboard focus rings, active states. |
| `gain` | `#34d399` | Emerald indicator for positive stream growth (▲). |
| `loss` | `#fb7185` | Rose indicator for negative listener churn (▼). |

---

## 2. Systems Craft & UX Architecture (Impeccable)

### Complete 4-State Surface Guarantee
Every page and interactive component implements all four UI states:
1. **Default State:** Clean data presentation with tabular numeric alignments.
2. **Loading Skeleton (`src/components/ui/Skeleton.tsx`):** Precision shimmering placeholder shapes matching exact content dimensions to prevent layout shifts (CLS).
3. **Empty State (`src/components/ui/EmptyState.tsx`):** Actionable guidance displayed when filters return 0 results or snapshots are pending.
4. **Error Boundary & State (`src/components/ui/ErrorBoundary.tsx`):** Graceful degradation capturing runtime errors without crashing the shell.

### Accessibility & Ergonomics
- **WCAG AA Compliance:** All text-to-background combinations exceed the 4.5:1 ratio (e.g. `chalk` on `pitch` achieves $17.3:1$).
- **Touch Ergonomics:** All buttons, filters, and row links enforce a minimum $44\text{px} \times 44\text{px}$ touch target (`min-h-[44px]`).
- **Color-Blind Safety:** Movement badges (`DeltaBadge`) pair color with directional arrow glyphs (▲/▼/—), ensuring clarity in grayscale.
- **Mobile-Friendly Viewports:** Built with `100dvh` (Dynamic Viewport Height) to eliminate mobile browser navigation bar stutter.

---

## 3. Motion Physics & Performance (Emil Kowalski)

### 60fps GPU Composited Rules
- **Properties Animated:** Strictly `transform` and `opacity`.
- **Banned CSS Transitions:** Animating `width`, `height`, `margin`, `padding`, `top`, `left`, or `filter: blur` is disallowed.
- **Physical Emergence:** Modals, tooltips, and badges scale from `0.95 \to 1.0` (never from `0`).
- **Tactile Feedback:** Buttons depress with `scale(0.97)` on `:active`.
- **Custom Easing:** Entrances use snappy `cubic-bezier(0.16, 1, 0.3, 1)` ease-out curves; exits leave rapidly.

---

## 4. Component Structure

```
src/components/
├── charts/
│   ├── DailyStreamChart.tsx   # Recharts bar graph for artist stream output
│   └── TrajectoryChart.tsx    # Multi-line comparative historical curves
├── layout/
│   ├── Navbar.tsx             # Global navigation bar with live status indicator
│   ├── Shell.tsx              # Application layout container
│   └── Sidebar.tsx            # Desktop / tablet navigation drawer
├── leaderboard/
│   ├── ArtistTable.tsx        # Sortable, searchable artist ledger
│   ├── DeltaBadge.tsx         # Numeric movement badge (+/- %, absolute delta)
│   └── TrackTable.tsx         # Scene-wide top gainer tracks table
└── ui/
    ├── EmptyState.tsx         # Zero-data fallback display
    ├── ErrorBoundary.tsx      # React error boundary wrapper & error cards
    ├── Skeleton.tsx           # Hairline shimmer skeletons
    └── index.ts               # Component barrel exports
```
