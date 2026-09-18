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

import { test, expect, type Page } from "@playwright/test";
import { ATTRACTIONS, ENTRANCE } from "../src/content/attractions";
import {
  PIN_LAYER_ACTIVE,
  PIN_LINKS,
  directoryLink,
  expectDirectoryListsEveryAttraction,
  pin,
  pins,
} from "./park";

const ROUTES = ["/", ...ATTRACTIONS.map((a) => `/${a.slug}`), `/${ENTRANCE.slug}`];

/** The WCAG 2.5.5 target-size floor, and the reference's own touch size. */
const MIN_TARGET = 44;

/**
 * Loads the park and requires it to be fully present, or skips on an engine
 * that genuinely cannot render it.
 *
 * Two of the assertions below are of the form "no pin is wrong", which an
 * empty pin set satisfies perfectly. On headless Firefox, which has no WebGL on
 * a CI runner, they were passing vacuously — and would have passed just as
 * well on a park that rendered no pins at all.
 *
 * The first fix keyed the skip on `canvas` being absent, which relocated the
 * same fault rather than removing it: a park broken on a *capable* engine also
 * renders no canvas. A renamed Empty in `assets/park_build.py` now makes
 * `src/park/pinnedAttractions.ts` throw and takes the park's dynamic import
 * down with it — leaving the rest of the site intact, by design — and that
 * would have skipped silently on chromium and reported green.
 *
 * So the skip is keyed on the engine's *capability*, probed directly, and never
 * on the outcome the tests exist to check. An engine with WebGL must produce
 * exactly one canvas and one pin per attraction, or these fail.
 *
 * Chromium is held to a stronger standard still: it has WebGL in every
 * environment this project runs in, so its absence there is a broken
 * environment rather than a platform fact, and it fails instead of skipping.
 * Without that, all four projects could take the skip at once and the run would
 * report twelve skips and a green tick — the same inability to tell "nothing is
 * wrong" from "nothing is there", moved from the assertion to the gate.
 *
 * Skipping costs the no-WebGL path no coverage: it has its own assertions at
 * the bottom of this file, where WebGL is removed deliberately before any
 * script runs and the directory is required to carry the whole site.
 */
async function requirePark(page: Page, browserName: string) {
  await page.goto("/");

  const hasWebGL = await page.evaluate(() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });

  if (!hasWebGL) {
    expect(
      browserName,
      "chromium has WebGL in every environment this project runs in, so its " +
        "absence is a broken environment rather than a platform fact",
    ).not.toBe("chromium");
    test.skip(true, `${browserName} has no WebGL; the park cannot mount`);
  }

  // Asserted rather than waited on a fixed timeout: `toHaveCount` retries, so
  // a contended runner makes this slower rather than intermittently wrong.
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(pins(page)).toHaveCount(ATTRACTIONS.length);
  // The pins are positioned by the render loop, so one frame must have run
  // before their geometry means anything.
  await expect(page.locator(PIN_LAYER_ACTIVE)).toBeVisible();

  // And then the pop-in has to finish, because a pin's `scale` is animated
  // from 0 and `getBoundingClientRect` reports the *scaled* box. Measuring a
  // pin mid-animation reads its hit target as smaller than it settles at —
  // which is a real but transient state, and not the one WCAG's target size
  // is about.
  //
  // The last pin lands at (ATTRACTIONS.length - 1) * --stagger-pin plus
  // --duration-pop: 6 * 100ms + 600ms = 1200ms. Waited on the tokens rather
  // than a round number so a change to either is followed here.
  const settle = await page.evaluate(() => {
    const read = (name: string) => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      if (raw.endsWith("ms")) return Number.parseFloat(raw) || 0;
      if (raw.endsWith("s")) return (Number.parseFloat(raw) || 0) * 1000;
      return 0;
    };
    return { stagger: read("--stagger-pin"), pop: read("--duration-pop") };
  });
  await page.waitForTimeout(
    (ATTRACTIONS.length - 1) * settle.stagger + settle.pop + 250,
  );
}

test.describe("the park fits its viewport", () => {
  test("shows every pin inside the frame", async ({ page, browserName }) => {
    // The camera distance is derived from the aspect ratio for this reason: a
    // constant tuned on a desktop put five of the seven pins off-screen on a
    // portrait phone, with no error anywhere.
    await requirePark(page, browserName);

    const offscreen = await page.evaluate((selector) => {
      const found = [...document.querySelectorAll(selector)];
      return found
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < 0 ||
            r.top < 0 ||
            r.right > window.innerWidth ||
            r.bottom > window.innerHeight
          );
        })
        .map((el) => el.getAttribute("href"));
    }, PIN_LINKS);

    expect(offscreen).toEqual([]);
  });

  test("gives every pin a large enough hit target", async ({
    page,
    browserName,
  }) => {
    await requirePark(page, browserName);

    const small = await page.evaluate(
      ({ floor, selector }) => {
        const found = [...document.querySelectorAll(selector)];
        return found
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width < floor || r.height < floor;
          })
          .map((el) => el.getAttribute("href"));
      },
      { floor: MIN_TARGET, selector: PIN_LINKS },
    );

    expect(small).toEqual([]);
  });

  test("keeps every pin's accessible name even where its label is hidden", async ({
    page,
    browserName,
  }) => {
    // On a narrow touch viewport the label is not drawn, because seven of them
    // do not fit. The name must still be there: a ring is an affordance, not a
    // reason for an attraction to become anonymous.
    await requirePark(page, browserName);

    for (const attraction of ATTRACTIONS) {
      await expect(
        pin(page, attraction.slug),
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

    await expectDirectoryListsEveryAttraction(page);

    // And the directory still navigates.
    await directoryLink(page, ATTRACTIONS[0].name).click();
    await expect(page).toHaveURL(new RegExp(`/${ATTRACTIONS[0].slug}$`));
  });
});
