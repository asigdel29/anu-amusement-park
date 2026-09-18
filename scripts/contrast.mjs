/**
 * contrast.mjs — computes WCAG 2.1 contrast ratios for the token palette and
 * prints them as a table.
 *
 * This is the reporting front end for the same arithmetic that
 * tests/tokens.test.ts asserts. It exists so that a token change can be
 * inspected by a human before the test tells them it failed.
 *
 * Usage: npm run contrast
 */

import { PALETTE, SURFACES, contrastRatio, AA_BODY, AA_LARGE } from "./contrast.lib.mjs";

const rows = Object.entries(PALETTE).map(([name, hex]) => {
  const onPanel = contrastRatio(hex, SURFACES.panel);
  const onGround = contrastRatio(hex, SURFACES.ground);
  const worst = Math.min(onPanel, onGround);
  return {
    token: name,
    hex,
    ground: onGround.toFixed(2),
    panel: onPanel.toFixed(2),
    body: worst >= AA_BODY ? "pass" : "FAIL",
    large: worst >= AA_LARGE ? "pass" : "FAIL",
  };
});

console.table(rows);

const unusable = rows.filter((r) => r.large === "FAIL");
if (unusable.length > 0) {
  console.error(
    `\n${unusable.length} token(s) fail AA large-text contrast and cannot be used for text at all:`,
    unusable.map((r) => r.token).join(", "),
  );
  process.exit(1);
}
