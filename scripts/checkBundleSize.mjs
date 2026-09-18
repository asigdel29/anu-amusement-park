/**
 * checkBundleSize.mjs — asserts the shipped-byte budgets from docs/DESIGN.md.
 *
 * Contract: exits 0 if every budget holds, 1 with a per-budget report if any is
 * exceeded. Requires a completed `next build`; run it after, not instead of.
 *
 * Budgets are measured as gzipped bytes for JavaScript, because that is what a
 * visitor downloads, and as raw bytes for the baked park assets, because glb
 * payloads are already Draco- and WebP-compressed and gzip barely moves them.
 *
 * Why a script rather than a bundler plugin: the park's cost is mostly the three
 * and R3F chunk plus a handful of binary assets, and both are simple file-size
 * questions. A plugin would have to be configured to answer them anyway.
 *
 * Invariant: a budget that is not yet reachable (the park assets, before the
 * Blender build lands) is reported as pending and does not fail the gate. A
 * budget whose files exist is always enforced. This is deliberate: a gate that
 * fails for a whole milestone is a gate people disable.
 */

import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();

/** Every budget the design doc commits to, in the units it commits to them in. */
const BUDGETS = [
  {
    name: "client JavaScript (all chunks, gzipped)",
    limit: 600 * 1024,
    measure: () => gzippedTotal(resolve(root, ".next/static/chunks"), /\.js$/),
  },
  // One budget rather than two, because the baked atlas is embedded inside the
  // glb rather than shipped beside it. Splitting geometry from textures here
  // would leave the texture budget permanently unmeasurable, reporting
  // "pending" forever while the bytes were counted under geometry anyway.
  // `npx @gltf-transform/cli inspect` gives the breakdown when it is wanted.
  {
    name: "baked park payload (public/models/park, geometry + atlas)",
    limit: 1.5 * 1024 * 1024,
    measure: () =>
      rawTotal(resolve(root, "public/models/park"), /\.(glb|gltf|bin|webp|png|ktx2|basis)$/),
  },
];

/** Every file under `dir` matching `pattern`, recursively. Empty if absent. */
function filesUnder(dir, pattern) {
  if (!existsSync(dir)) return null;
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...(filesUnder(path, pattern) ?? []));
    } else if (pattern.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Returns null when the directory does not exist, so a not-yet-built budget is
 * distinguishable from one measured at zero. Conflating the two would let a
 * broken build path report a passing budget.
 */
function rawTotal(dir, pattern) {
  const files = filesUnder(dir, pattern);
  if (files === null || files.length === 0) return null;
  return files.reduce((sum, f) => sum + statSync(f).size, 0);
}

function gzippedTotal(dir, pattern) {
  const files = filesUnder(dir, pattern);
  if (files === null || files.length === 0) return null;
  return files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
}

const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;

let failed = false;
const rows = [];

for (const budget of BUDGETS) {
  const actual = budget.measure();
  if (actual === null) {
    rows.push({ budget: budget.name, actual: "—", limit: kib(budget.limit), status: "pending" });
    continue;
  }
  const over = actual > budget.limit;
  if (over) failed = true;
  rows.push({
    budget: budget.name,
    actual: kib(actual),
    limit: kib(budget.limit),
    status: over ? `OVER by ${kib(actual - budget.limit)}` : "ok",
  });
}

console.table(rows);

if (failed) {
  console.error(
    "\nOne or more shipped-byte budgets were exceeded. Either bring the payload " +
      "back under the limit, or change the budget in docs/DESIGN.md and here " +
      "together, with the measurement that justifies it.",
  );
  process.exit(1);
}
