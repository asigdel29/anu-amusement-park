/**
 * End-to-end tests for reach: that the site works on a phone, and that the
 * park never becomes the only way in.
 *
 * These are the assertions that caught the two real mobile faults. The park
 * was framed on a desktop viewport and cropped to its centre on a phone, and
 * seven always-on pin labels overlapped each other, ran off both edges and
 * collided with the site's own title. Neither is visible from a unit test, and
 * neither produced an error.
 */

import { test, expect } from "@playwright/test";
import { ATTRACTIONS, ENTRANCE } from "../src/content/attractions";

const ROUTES = ["/", ...ATTRACTIONS.map((a) => `/${a.slug}`), `/${ENTRANCE.slug}`];

/** The WCAG 2.5.5 target-size floor, and the reference's own touch size. */
const MIN_TARGET = 44;

test.describe("the park fits its viewport", () => {
  test("shows every pin inside the frame", async ({ page }) => {
    // The camera distance is derived from the aspect ratio for this reason: a
    // constant tuned on a desktop put five of the seven pins off-screen on a
    // portrait phone, with no error anywhere.
    await page.goto("/");
    await page.waitForTimeout(3500);

    const offscreen = await page.evaluate(() => {
      const pins = [...document.querySelectorAll('[class*="Pins-module"] a')];
      return pins
        .filter((pin) => {
          const r = pin.getBoundingClientRect();
          return (
            r.left < 0 ||
            r.top < 0 ||
            r.right > window.innerWidth ||
            r.bottom > window.innerHeight
          );
        })
        .map((pin) => pin.getAttribute("href"));
    });

    expect(offscreen).toEqual([]);
  });

  test("gives every pin a large enough hit target", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3500);

    const small = await page.evaluate((floor) => {
      const pins = [...document.querySelectorAll('[class*="Pins-module"] a')];
      return pins
        .filter((pin) => {
          const r = pin.getBoundingClientRect();
          return r.width < floor || r.height < floor;
        })
        .map((pin) => pin.getAttribute("href"));
    }, MIN_TARGET);

    expect(small).toEqual([]);
  });

  test("keeps every pin's accessible name even where its label is hidden", async ({
    page,
  }) => {
    // On a narrow touch viewport the label is not drawn, because seven of them
    // do not fit. The name must still be there: a ring is an affordance, not a
    // reason for an attraction to become anonymous.
    await page.goto("/");
    await page.waitForTimeout(3500);

    for (const attraction of ATTRACTIONS) {
      await expect(
        page.locator(`[class*="Pins-module"] a[href="/${attraction.slug}"]`),
      ).toHaveAccessibleName(new RegExp(attraction.name, "i"));
    }
  });
});

test.describe("no route overflows a phone", () => {
  // A narrow viewport rather than a full device descriptor: a descriptor
  // carries `defaultBrowserType`, which Playwright refuses inside a describe
  // block because it would force a new worker. Overriding only the viewport
  // means this runs in every configured engine, which is broader coverage than
  // pinning it to one.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const route of ROUTES) {
    test(`${route} has no horizontal scroll`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(500);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      // A page wider than its viewport on a phone is the most common
      // responsive fault and the least often noticed on a desktop.
      expect(scrollWidth, route).toBeLessThanOrEqual(innerWidth);
    });
  }
});

test.describe("the park is never the only way in", () => {
  test("a browser with no WebGL still reaches every attraction", async ({
    page,
  }) => {
    // The strongest form of the substrate guarantee. WebGL is removed before
    // any script runs, so the park cannot mount at all — and the site must be
    // entirely unaffected.
    await page.addInitScript(() => {
      const blocked = ["webgl", "webgl2", "experimental-webgl"];
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (blocked.includes(kind)) return null;
        return (original as never as (...a: unknown[]) => unknown).call(
          this,
          kind,
          ...rest,
        );
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto("/");
    await page.waitForTimeout(1500);

    // No canvas, and no pins — the park declined to render rather than
    // rendering a broken one.
    await expect(page.locator("canvas")).toHaveCount(0);

    const directory = page.getByRole("navigation", { name: "park directory" });
    await expect(directory).toBeVisible();
    for (const attraction of ATTRACTIONS) {
      await expect(
        directory.getByRole("link", { name: new RegExp(attraction.name, "i") }),
      ).toBeVisible();
    }

    // And the directory still navigates.
    await directory
      .getByRole("link", { name: new RegExp(ATTRACTIONS[0].name, "i") })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${ATTRACTIONS[0].slug}$`));
  });
});
