/**
 * Type declarations for scripts/contrast.lib.mjs.
 *
 * The implementation stays plain JavaScript because scripts/contrast.mjs is run
 * directly by Node with no build step. This file is the typed contract the test
 * suite compiles against, so the gate and the report share one implementation
 * without the report needing a compiler.
 *
 * Invariant: this file and contrast.lib.mjs must be edited together. There is no
 * checker that enforces it, so the two are kept deliberately small.
 */

/** WCAG 2.1 AA minimum contrast ratio for body text. */
export declare const AA_BODY: 4.5;

/** WCAG 2.1 AA minimum contrast ratio for large text. */
export declare const AA_LARGE: 3.0;

/** The two background colours this site renders text on. */
export declare const SURFACES: Readonly<Record<"ground" | "panel", string>>;

/** Every colour token that may be used for text, keyed by token name. */
export declare const PALETTE: Readonly<Record<string, string>>;

/** Token names restricted to large text, signage and pin fills. */
export declare const LARGE_TEXT_ONLY: ReadonlySet<string>;

/**
 * WCAG relative luminance of an opaque sRGB colour, in [0, 1].
 * @throws if `hex` is not a six-digit hex colour.
 */
export declare function relativeLuminance(hex: string): number;

/**
 * WCAG contrast ratio between two opaque sRGB colours, in [1, 21].
 * Order-independent.
 * @throws if either argument is not a six-digit hex colour.
 */
export declare function contrastRatio(a: string, b: string): number;

/**
 * The lowest contrast ratio `hex` achieves against any surface in `SURFACES`.
 * Gates use this rather than a single surface so a colour must be legible
 * everywhere it appears, not merely somewhere.
 * @throws if `hex` is not a six-digit hex colour.
 */
export declare function worstCaseRatio(hex: string): number;
