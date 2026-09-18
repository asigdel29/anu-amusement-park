/**
 * contrast.lib.mjs — WCAG 2.1 relative-luminance and contrast-ratio arithmetic,
 * plus the palette and surface values the design system actually ships.
 *
 * Contract: `contrastRatio(a, b)` returns the WCAG contrast ratio between two
 * opaque sRGB hex colors, in the range [1, 21], order-independent.
 *
 * Requires of callers: six-digit hex strings, with or without a leading `#`.
 * Three-digit shorthand and alpha channels are not accepted — a token file that
 * needs either has a problem this function should not paper over.
 *
 * Why a shared library rather than duplicating the math: the reporting script and
 * the test must agree by construction. If they were separate implementations, a
 * rounding difference between them would make the gate argue with the report.
 *
 * PALETTE and SURFACES mirror src/design/tokens.css. They are duplicated here
 * rather than parsed out of the CSS because a regex over a stylesheet is a worse
 * failure mode than a stale constant: tests/tokens.test.ts asserts that every key
 * below is actually present in tokens.css with the same value, so the two cannot
 * drift silently.
 */

/** WCAG 2.1 AA minimum for body text. */
export const AA_BODY = 4.5;

/** WCAG 2.1 AA minimum for large text (>= 24px, or >= 18.66px bold). */
export const AA_LARGE = 3.0;

export const SURFACES = {
  ground: "#08070d",
  panel: "#121019",
};

export const PALETTE = {
  "neon-pink": "#ff3891",
  "neon-yellow": "#ffbf04",
  "neon-cyan": "#00c2ff",
  "neon-purple": "#ad00ff",
  "neon-mint": "#4ff29f",
  "neon-blue": "#38b7ff",
  "text-primary": "#f4f1ea",
  "text-muted": "#9a94ad",
};

/**
 * Accents that fail AA body contrast against a site surface and are therefore
 * admissible only for large display type, park signage and pin fills. This list
 * is an assertion about the palette, not a preference: tests/tokens.test.ts fails
 * if a token outside it turns out to be body-unsafe, or if a token inside it turns
 * out to be safe after all.
 */
export const LARGE_TEXT_ONLY = new Set(["neon-purple"]);

/** Expands `#rrggbb` (or `rrggbb`) to channel bytes. Throws on anything else. */
function channels(hex) {
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`expected a six-digit hex color, got ${JSON.stringify(hex)}`);
  }
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

/**
 * Linearises one sRGB channel byte. The 0.03928 threshold and 2.4 exponent are
 * from the WCAG 2.1 definition of relative luminance; they are not tunable.
 */
function linearise(byte) {
  const c = byte / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an opaque sRGB color, in [0, 1]. */
export function relativeLuminance(hex) {
  const [r, g, b] = channels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque sRGB colors, in [1, 21]. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The worst contrast a color achieves against any surface the site renders it on.
 * A token is only safe if it is safe on both surfaces, so every gate uses this
 * rather than picking the flattering one.
 */
export function worstCaseRatio(hex) {
  return Math.min(
    contrastRatio(hex, SURFACES.ground),
    contrastRatio(hex, SURFACES.panel),
  );
}
