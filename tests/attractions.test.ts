/**
 * Contract tests for src/content/attractions.ts.
 *
 * What this guards: the invariants declared in that module's header. Three
 * independent consumers read ATTRACTIONS — the pin layer, the router, and the
 * Blender build — and nothing but these tests makes them agree.
 *
 * The pins.json check is conditional on the file existing. Before the Blender
 * build lands (see docs/ASSETS.md) there is nothing to compare against, and a
 * test that fails for the whole of M1 is a test people learn to ignore. Once the
 * file exists the check becomes mandatory, and it fails loudly on any mismatch.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_SLUGS,
  ATTRACTIONS,
  ENTRANCE,
  attractionBySlug,
} from "@/content/attractions";
import { LARGE_TEXT_ONLY, PALETTE } from "../scripts/contrast.lib.mjs";

const projectRoot = process.cwd();
const pinsPath = resolve(projectRoot, "assets/pipeline/pins.json");

describe("identity invariants", () => {
  it("has a unique id per attraction", () => {
    const ids = ATTRACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a unique slug per attraction, distinct from the entrance", () => {
    expect(new Set(ALL_SLUGS).size).toBe(ALL_SLUGS.length);
    expect(ATTRACTIONS.map((a) => a.slug)).not.toContain(ENTRANCE.slug);
  });

  it("uses ids that are legal Blender object names and stable identifiers", () => {
    // park_build.py names an empty after each id, and the glTF exporter mangles
    // anything outside this set — which would break the pins.json join silently.
    for (const { id } of ATTRACTIONS) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("uses slugs that are legal single URL path segments", () => {
    for (const slug of ALL_SLUGS) {
      expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe("routing invariants", () => {
  it("has a route directory with a page for every slug", () => {
    for (const slug of ALL_SLUGS) {
      const page = resolve(projectRoot, "app", slug, "page.tsx");
      expect(existsSync(page), `expected ${slug}/page.tsx to exist`).toBe(true);
    }
  });

  it("has no route directory that no attraction claims", () => {
    // Catches the reverse drift: a page left behind after an attraction was
    // renamed is a route the park has no pin for, reachable only by URL.
    const appDir = resolve(projectRoot, "app");
    const routeDirs = readdirSync(appDir).filter((entry) => {
      if (entry.startsWith("_") || entry.startsWith("(")) return false;
      return statSync(resolve(appDir, entry)).isDirectory();
    });
    expect(routeDirs.sort()).toEqual([...ALL_SLUGS].sort());
  });

  it("resolves a known slug and rejects an unknown one", () => {
    expect(attractionBySlug("arcade").id).toBe("agent_arcade");
    expect(() => attractionBySlug("tunnel-of-love")).toThrow(/no attraction/);
  });
});

describe("accent invariants", () => {
  it("only uses accents that tokens.css actually declares", () => {
    for (const { accent } of ATTRACTIONS) {
      expect(Object.keys(PALETTE)).toContain(accent);
    }
  });

  it("records which attractions carry a large-text-only accent", () => {
    // Not a failure — an accent that fails body contrast is fine on a pin and on
    // a heading rule. This asserts the set is the one the styling was written
    // against, so adding another such accent forces a look at those components.
    const restricted = ATTRACTIONS.filter((a) => LARGE_TEXT_ONLY.has(a.accent)).map(
      (a) => a.id,
    );
    expect(restricted).toEqual(["idea_graveyard"]);
  });
});

describe("content honesty", () => {
  it("marks an attraction under construction rather than hiding it", () => {
    // The park is modelled on a map where every pin is visible. An attraction
    // without content says so; it does not disappear from the directory.
    const statuses = new Set(ATTRACTIONS.map((a) => a.status));
    expect(statuses.has("under-construction")).toBe(true);
    expect(ATTRACTIONS.every((a) => a.tagline.trim().length > 0)).toBe(true);
  });
});

describe("Blender join", () => {
  it("agrees with pins.json once the Blender build has produced it", () => {
    if (!existsSync(pinsPath)) {
      // Documented gap, not a silent skip: see this file's header.
      expect(ATTRACTIONS.length).toBeGreaterThan(0);
      return;
    }
    const pins = JSON.parse(readFileSync(pinsPath, "utf8")) as Record<
      string,
      [number, number, number]
    >;
    expect(Object.keys(pins).sort()).toEqual(ATTRACTIONS.map((a) => a.id).sort());
    for (const [id, position] of Object.entries(pins)) {
      expect(position, `${id} position`).toHaveLength(3);
      expect(position.every((n) => Number.isFinite(n)), `${id} position`).toBe(true);
    }
  });
});
