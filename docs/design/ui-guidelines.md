# UI Guidelines and Motion Standards

## 1. The Four-State Surface Standard

To adhere to the Impeccable craft floor standard, every page, panel, and data-driven component must implement four distinct visual states:

1. **Default State:** Clean data rendering with tabular numerical alignment and directional movement badges.
2. **Loading Skeleton (`src/components/ui/Skeleton.tsx`):**
   - Precise hairline placeholder shapes matching the exact layout and height of pending content.
   - Prevents Cumulative Layout Shift (CLS).
   - Component: `<Skeleton className="h-6 w-32" />` and `<SkeletonStat />`.
3. **Empty State (`src/components/ui/EmptyState.tsx`):**
   - Rendered when search queries yield zero matches or database snapshots have not yet landed.
   - Provides clear messaging and actionable resolution buttons (e.g. "Reset Filters").
4. **Error Boundary (`src/components/ui/ErrorBoundary.tsx`):**
   - Captures client-side rendering exceptions.
   - Renders a localized failure card with a "Retry" trigger, isolating crashes from the global console layout.

---

## 2. Touch Ergonomics and Accessibility

- **Minimum Touch Targets:** All interactive elements (table headers, sort toggles, search input clear buttons, navigation links) must measure at least $44\text{px} \times 44\text{px}$ in touch area (`min-h-[44px] min-w-[44px]`).
- **WCAG AA Contrast Compliance:**
  - Chalk (`#f2f2ef`) on Pitch (`#0b0b0e`) yields a $17.3:1$ contrast ratio (exceeding the $4.5:1$ threshold for body text).
  - Ash (`#a2a2ab`) on Pitch yields a $12.7:1$ contrast ratio.
  - Dim (`#7e7e88`) on Pitch yields a $6.2:1$ contrast ratio.
- **Color-Blind Safe Movement Indicators:** Movement badges (`DeltaBadge`) must never rely on color alone. Every badge pairs color with an explicit directional arrow glyph:
  - Positive increase: Emerald green with `▲` glyph.
  - Negative decrease: Rose red with `▼` glyph.
  - Neutral / zero change: Ash gray with `—` glyph.
- **Dynamic Viewport Height:** Mobile containers use `100dvh` rather than `100vh` to eliminate content jump when mobile browser navigation bars collapse.

---

## 3. Motion Physics and 60fps Performance Rules

Adhering to Emil Kowalski's design engineering motion standards:

### GPU Compositing Only
- **Permitted Transition Properties:** Animations must mutate **only** `transform` and `opacity`.
- **Prohibited Transition Properties:** Animating `width`, `height`, `margin`, `padding`, `top`, `left`, or `filter: blur` is prohibited as it causes browser layout recalculations and dropped frames.

### Natural Physical Emergence
- Elements appearing on screen (modals, tooltips, popovers) must emerge from `transform: scale(0.95); opacity: 0` to `transform: scale(1.0); opacity: 1`. Scaling from zero (`scale(0)`) is prohibited.
- Entrance curves use snappy ease-out physics: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Exit transitions leave faster than entrances (150ms vs 200–250ms).

### Tactile Feedback
- Buttons and clickable rows must provide tactile physical feedback on click/press:
  ```css
  button:active {
    transform: scale(0.97);
  }
  ```
