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
  directory,
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

test.describe("the park can be orbited by touch", () => {
  test.use({ hasTouch: true });

  test("a one-finger drag moves the camera", async ({ page, browserName }) => {
    // The gesture this asserts is the only way to orbit the park on a phone,
    // and it was broken for the whole of the build without a single suite
    // noticing: `touches` was written as `{ ONE: 1, TWO: 2 }`, which reads as
    // "one finger, two fingers" but is `{ ONE: PAN, TWO: DOLLY_PAN }` in
    // three's `TOUCH` enum — and panning is disabled, so one finger was bound
    // to a disabled action.
    //
    // Nothing else covers it. The other specs tap pins, which is a different
    // code path entirely, and the latency harness orbits with a mouse, which
    // OrbitControls routes through `mouseButtons` rather than `touches`.
    await requirePark(page, browserName);

    const positions = () =>
      page.$$eval(PIN_LINKS, (els) =>
        els
          .map((el) => (el as HTMLElement).style.getPropertyValue("--translateX"))
          .join("|"),
      );

    const before = await positions();

    // Dispatched as pointer events with `pointerType: "touch"` rather than
    // through `page.touchscreen`, which can tap but cannot drag. This is the
    // branch OrbitControls takes for a finger: it reads `pointerType` on
    // pointerdown and hands off to its touch handlers.
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("no canvas to drag");
      const at = (x: number) =>
        new PointerEvent("pointermove", {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: Math.round(window.innerHeight * 0.45),
          bubbles: true,
          cancelable: true,
        });

      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 120,
          clientY: Math.round(window.innerHeight * 0.45),
          bubbles: true,
          cancelable: true,
        }),
      );
      for (let step = 1; step <= 12; step += 1) {
        canvas.dispatchEvent(at(120 + step * 15));
      }
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 300,
          clientY: Math.round(window.innerHeight * 0.45),
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    // The damping tail keeps rendering for a few frames after the finger lifts.
    await expect
      .poll(positions, { timeout: 4000 })
      .not.toBe(before);
  });
});

test.describe("the page still scrolls under the park", () => {
  test.use({ hasTouch: true, viewport: { width: 393, height: 852 } });

  test("a vertical drag reaches the directory", async ({
    page,
    browserName,
    context,
  }) => {
    // The park's stage is fixed and fills the viewport, so the controls'
    // element is what a finger lands on everywhere on the page. OrbitControls
    // sets `touch-action: none` on it in `connect()`, which took every drag —
    // and since the masthead is `min-height: 100dvh`, the directory sits below
    // the fold on every phone. The park was reachable by touch and the site
    // underneath it was not.
    //
    // Chromium only: this needs real touch input, and `Input.dispatchTouchEvent`
    // goes through the browser's gesture recognition, which is what consults
    // `touch-action`. Playwright's own touch API can tap but not drag, and
    // synthetic pointer events bypass arbitration entirely — under either, this
    // assertion would pass against a page that cannot be scrolled at all.
    test.skip(
      browserName !== "chromium",
      "needs CDP touch input to exercise gesture arbitration",
    );

    await requirePark(page, browserName);
    const cdp = await context.newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });

    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await touch("touchStart", 200, 640);
    for (let step = 1; step <= 14; step += 1) {
      await touch("touchMove", 200, 640 - step * 30);
    }
    await touch("touchEnd", 200, 220);

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // And the thing the scroll exists to reach is actually on screen.
    await expect(directory(page)).toBeInViewport();
  });

  test("a horizontal drag still orbits rather than scrolling", async ({
    page,
    browserName,
    context,
  }) => {
    // The other half of `pan-y`: giving vertical drags back to the browser
    // must not give away the gesture that spins the island.
    test.skip(
      browserName !== "chromium",
      "needs CDP touch input to exercise gesture arbitration",
    );

    await requirePark(page, browserName);
    const cdp = await context.newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });

    const positions = () =>
      page.$$eval(PIN_LINKS, (els) =>
        els
          .map((el) => (el as HTMLElement).style.getPropertyValue("--translateX"))
          .join("|"),
      );
    const before = await positions();

    await touch("touchStart", 200, 620);
    for (let step = 1; step <= 12; step += 1) {
      await touch("touchMove", 200 + step * 14, 620);
    }
    await touch("touchEnd", 368, 620);

    await expect.poll(positions, { timeout: 4000 }).not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("every route's own navigation is thumb-sized", () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  for (const attraction of ATTRACTIONS) {
    test(`${attraction.name} can be left again`, async ({ page }) => {
      // `← back to the park` is the only navigation on an attraction page, so
      // on a phone it is the control a visitor reaches for most. As a bare
      // line of small text it measured 131x22 — half the floor the pins are
      // held to, and under the 24px AA minimum as well, which does not exempt
      // it because it is a standalone link and not one inside a sentence.
      //
      // Asserted per route rather than once, because the layout is shared and
      // a page that stopped using it would lose this silently.
      await page.goto(`/${attraction.slug}`);
      const back = page.getByRole("link", { name: /back to the park/i });
      const box = await back.boundingBox();
      expect(box, `${attraction.slug} has no way back`).not.toBeNull();
      expect(box!.height, `${attraction.slug} back link height`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
    });
  }
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
