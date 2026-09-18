/**
 * Contract tests for the design system's colour invariants.
 *
 * What this guards: the three invariants declared at the top of
 * src/design/tokens.css. Those are prose in a stylesheet, which nothing enforces;
 * these tests are the enforcement.
 *
 * In particular, `LARGE_TEXT_ONLY` is asserted in both directions. A one-way check
 * would let a token quietly become body-unsafe after a palette tweak while the
 * restriction list still claimed it was fine — or keep an obsolete restriction on
 * a token that no longer needs it, which teaches people to ignore the list.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AA_BODY,
  AA_LARGE,
  LARGE_TEXT_ONLY,
  PALETTE,
  SURFACES,
  contrastRatio,
  relativeLuminance,
  worstCaseRatio,
} from "../scripts/contrast.lib.mjs";
import { ACCENTS, SURFACES as DESIGN_SURFACES } from "@/design/palette";

// Resolved from the working directory rather than from `import.meta.url`: under
// Vitest's jsdom environment the module's own URL is not a `file:` URL, so the
// latter throws. `npm run test` always runs from the project root.
const tokensCss = readFileSync(
  resolve(process.cwd(), "src/design/tokens.css"),
  "utf8",
);

/** Reads a custom property's declared value out of the token stylesheet. */
function declaredValue(name: string): string | undefined {
  const match = tokensCss.match(
    new RegExp(`--${name}:\\s*([^;]+);`),
  );
  return match?.[1].trim();
}

describe("contrast arithmetic", () => {
  // Anchors from the WCAG definition. If these drift, the ratios everything else
  // asserts are meaningless, so they are checked before anything depends on them.
  it("matches the WCAG reference values at the extremes", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#08070d", "#08070d")).toBeCloseTo(1, 10);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#ff3891", "#121019")).toBeCloseTo(
      contrastRatio("#121019", "#ff3891"),
      10,
    );
  });

  it("rejects colours it cannot interpret rather than guessing", () => {
    expect(() => contrastRatio("#fff", "#121019")).toThrow(/six-digit/);
    expect(() => contrastRatio("rebeccapurple", "#121019")).toThrow(/six-digit/);
    expect(() => contrastRatio("#ff3891ff", "#121019")).toThrow(/six-digit/);
  });
});

describe("tokens.css agrees with the palette the gates check", () => {
  it.each(Object.entries(PALETTE))(
    "declares --%s as %s",
    (name, hex) => {
      expect(declaredValue(name)?.toLowerCase()).toBe(hex.toLowerCase());
    },
  );

  it.each(Object.entries(SURFACES))(
    "declares --surface-%s as %s",
    (name, hex) => {
      expect(declaredValue(`surface-${name}`)?.toLowerCase()).toBe(
        hex.toLowerCase(),
      );
    },
  );
});

describe("src/design/palette.ts agrees with tokens.css", () => {
  // The renderer-facing copy of the palette. It exists because an
  // ImageResponse has no stylesheet, so `var(--neon-cyan)` there is a
  // transparent rule rather than an error — which is exactly why it needs a
  // gate. Before this, ogImage.tsx carried its own hexes and claimed in a
  // comment that this test asserted them. Nothing did.
  it.each(Object.entries(ACCENTS))("declares --%s as %s", (name, hex) => {
    expect(declaredValue(name)?.toLowerCase()).toBe(hex.toLowerCase());
  });

  it.each(Object.entries(DESIGN_SURFACES))(
    "declares --%s as %s",
    (name, hex) => {
      expect(declaredValue(name)?.toLowerCase()).toBe(hex.toLowerCase());
    },
  );

  it("covers every accent the attraction list can use", () => {
    // A new accent token added to tokens.css and to AccentToken but forgotten
    // here would render a card with an undefined colour.
    expect(Object.keys(ACCENTS).sort()).toEqual(
      Object.keys(PALETTE).filter((k) => k.startsWith("neon-")).sort(),
    );
  });
});

describe("palette contrast invariants", () => {
  // Invariant 1: nothing in the palette is unusable for text at any size.
  it.each(Object.entries(PALETTE))(
    "%s clears AA large-text contrast on every surface",
    (_name, hex) => {
      expect(worstCaseRatio(hex)).toBeGreaterThanOrEqual(AA_LARGE);
    },
  );

  // Invariant 2, forwards: every unrestricted token is genuinely body-safe.
  it.each(
    Object.entries(PALETTE).filter(([name]) => !LARGE_TEXT_ONLY.has(name)),
  )("%s is body-safe, as its lack of a restriction claims", (_name, hex) => {
    expect(worstCaseRatio(hex)).toBeGreaterThanOrEqual(AA_BODY);
  });

  // Invariant 2, backwards: every restricted token genuinely needs restricting.
  it.each(
    Object.entries(PALETTE).filter(([name]) => LARGE_TEXT_ONLY.has(name)),
  )("%s needs its large-text-only restriction", (_name, hex) => {
    expect(worstCaseRatio(hex)).toBeLessThan(AA_BODY);
  });
});

describe("motion invariants", () => {
  // Invariant 3: the reduced-motion block must zero every duration token, or a
  // component that dutifully references the tokens still animates.
  it("zeroes every duration and stagger token under reduced motion", () => {
    const reducedBlock = tokensCss.slice(
      tokensCss.indexOf("prefers-reduced-motion"),
    );
    const durationTokens = [
      ...tokensCss.matchAll(/--(duration-[a-z]+|stagger-[a-z]+):/g),
    ].map((m) => m[1]);

    expect(new Set(durationTokens).size).toBeGreaterThan(0);
    for (const token of new Set(durationTokens)) {
      expect(reducedBlock).toMatch(new RegExp(`--${token}:\\s*0s;`));
    }
  });
});
