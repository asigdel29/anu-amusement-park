/**
 * Screenshot regression for the park and its pages.
 *
 * Contract: captures the park at three fixed camera poses and every content
 * route, and compares each against a committed baseline.
 *
 * Requires of callers: `npm run build` first, and a deliberate
 * `--update-snapshots` when a change to the look is intended. Read
 * `playwright.regression.config.ts` on why this is not in CI.
 *
 * The poses are reached by dragging rather than by a test-only hook on the
 * camera. A production seam that exists only so a test can pose the camera is
 * a seam that can be wrong in production while the test passes; driving the
 * real controls means the capture exercises the same path a visitor does.
 *
 * Damping is what makes this work: the orbit controls converge, so a fixed
 * drag followed by a fixed settle lands in the same place every run.
 *
 * Calibration, measured rather than assumed
 * -----------------------------------------
 * The park's tolerance is deliberately looser than the pages', because a WebGL
 * render has a noise floor that DOM output does not. Measured on one machine,
 * with nothing in this repository changed between runs:
 *
 *   run-to-run noise, same bake                        3-4% of pixels
 *   a 21% brighter bake light (3.4 -> 4.1 sun energy)  9% of pixels
 *   a 53% brighter bake light (3.4 -> 5.2)             15-34% of pixels
 *
 * So 6% sits above the noise and below the smallest change worth catching.
 *
 * Both ends of that were verified, and the first attempt failed both ways.
 * Playwright's default `threshold` of 0.2 is so loose that a 53% brightness
 * change moved no single pixel enough to count and the suite passed — a gate
 * that passes everything manufactures confidence. Tightened to 0.02 it caught
 * the change but also began failing on its own noise. The pair of numbers is
 * what makes it a gate rather than a coin toss.
 */

import { test, expect, type Page } from "@playwright/test";
import { ATTRACTIONS, ENTRANCE } from "../src/content/attractions";

/**
 * Pixel-ratio tolerance for a WebGL capture. See the calibration note above:
 * above the park's measured run-to-run noise, below a real change in the bake.
 */
const PARK_TOLERANCE = { maxDiffPixelRatio: 0.06 };

/** Waits until the park has loaded and its pins are on screen. */
async function parkReady(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[class*="Pins-module"][class*="active"]', {
    timeout: 30_000,
  });
  // The pins stagger in over --duration-pop plus their delay, and the damped
  // camera settles after its first frame. Capturing before both are done makes
  // a baseline that is a moment rather than a state.
  await page.waitForTimeout(2000);
}

/** Drags across the canvas and lets the damped controls settle. */
async function orbit(page: Page, dx: number, dy: number) {
  await page.mouse.move(640, 450);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(640 + (dx * step) / 20, 450 + (dy * step) / 20);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  // Damping is exponential, so this is comfortably past the point where
  // further movement is below the screenshot's per-pixel threshold.
  await page.waitForTimeout(1500);
}

test.describe("the park's look", () => {
  test("the pose it opens on", async ({ page }) => {
    await parkReady(page);
    await expect(page).toHaveScreenshot("park-initial.png", PARK_TOLERANCE);
  });

  test("turned to the east side", async ({ page }) => {
    await parkReady(page);
    await orbit(page, 320, 0);
    await expect(page).toHaveScreenshot("park-turned.png", PARK_TOLERANCE);
  });

  test("tilted toward the horizon", async ({ page }) => {
    // The shallow end of the permitted orbit band, which is where a broken
    // clamp would first show the water plane edge-on.
    await parkReady(page);
    await orbit(page, 0, -220);
    await expect(page).toHaveScreenshot("park-tilted.png", PARK_TOLERANCE);
  });
});

test.describe("the pages' look", () => {
  // The park is a fixed backdrop on `/` only, so these are pure DOM captures
  // and are stable across platforms in a way the park is not.
  for (const slug of [...ATTRACTIONS.map((a) => a.slug), ENTRANCE.slug]) {
    test(`/${slug}`, async ({ page }) => {
      await page.goto(`/${slug}`);
      // Fonts must be in before capture or the first run bakes a fallback
      // face into the baseline.
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`page-${slug}.png`, {
        fullPage: true,
      });
    });
  }
});
