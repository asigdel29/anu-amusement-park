/**
 * palette.ts — the colour values, in the one form every consumer can read.
 *
 * Contract: the accent and surface values the design system ships, as plain
 * data. `src/design/tokens.css` remains the authority for how they are *used*;
 * this is the same numbers in a form a renderer without a stylesheet, a bare
 * Node script, and a Python build can all reach.
 *
 * Why this exists: the palette had four copies — tokens.css, contrast.lib.mjs,
 * ogImage.tsx and park_build.py — and the comment on the fourth claimed it was
 * "asserted against tokens.css by tests/tokens.test.ts". It was not. That test
 * reads contrast.lib.mjs, and nothing read ogImage's copy at all, so changing
 * an accent in tokens.css left every social card shipping the old colour with
 * every gate green.
 *
 * The constraints that made duplication look unavoidable are real but narrower
 * than they seemed: an `ImageResponse` renders with no stylesheet and no custom
 * properties, so `var(--neon-cyan)` there is a transparent rule and not an
 * error. That argues for a module it can import, not for a second set of
 * literals. `tests/tokens.test.ts` now asserts this file against tokens.css, so
 * there is one guarded source instead of one guarded and one silent.
 *
 * tokens.css is deliberately NOT generated from this. It is 149 lines of
 * authored, annotated design decisions — the type scale, four easing curves,
 * breakpoints, the reduced-motion block — of which the palette is six. Moving
 * all of that behind a generator to remove one duplicate would cost the
 * comments and add a build step.
 */

import type { AccentToken } from "@/content/attractions";

/** The six accents. Keys match the `--` token names in tokens.css. */
export const ACCENTS: Readonly<Record<AccentToken, string>> = {
  "neon-pink": "#ff3891",
  "neon-yellow": "#ffbf04",
  "neon-cyan": "#00c2ff",
  "neon-purple": "#ad00ff",
  "neon-mint": "#4ff29f",
  "neon-blue": "#38b7ff",
};

/** The surfaces and text colours, keyed by their token name. */
export const SURFACES = {
  "surface-ground": "#08070d",
  "surface-panel": "#121019",
  "text-primary": "#f4f1ea",
  "text-muted": "#9a94ad",
} as const;
