/**
 * End-to-end tests for the park's navigation guarantees.
 *
 * What these guard: that every attraction is reachable by three independent
 * means — a pointer, a keyboard, and a browser with JavaScript switched off.
 * The unit suite can assert that a route file exists; only a browser can assert
 * that a visitor can actually get there.
 *
 * These run before the 3D layer exists and must keep passing after it lands.
 * That is the point: the park renders over this markup, and if a change to the
 * park breaks the path underneath it, these fail.
 */

import { test, expect } from "@playwright/test";
import { ATTRACTIONS, ENTRANCE } from "../src/content/attractions";
import { PROFILE } from "../src/content/profile";
import {
  directoryLink,
  expectDirectoryListsEveryAttraction,
} from "./park";

test.describe("the park directory", () => {
  test("lists every attraction", async ({ page }) => {
    await page.goto("/");
    await expectDirectoryListsEveryAttraction(page);
  });

  test("names the park and its subtitle in the document", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "debugging reality",
    );
    await expect(page.getByText("rides may break in production")).toBeVisible();
  });
});

for (const attraction of ATTRACTIONS) {
  test.describe(attraction.name, () => {
    test("opens from the directory and names itself", async ({ page }) => {
      await page.goto("/");
      await directoryLink(page, attraction.name).click();

      await expect(page).toHaveURL(new RegExp(`/${attraction.slug}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        attraction.name,
      );
    });

    test("offers a way back to the park", async ({ page }) => {
      await page.goto(`/${attraction.slug}`);
      await page.getByRole("link", { name: /back to the park/i }).click();
      await expect(page).toHaveURL(/\/$/);
    });

    if (attraction.status === "under-construction") {
      test("says plainly that it has no content yet", async ({ page }) => {
        await page.goto(`/${attraction.slug}`);
        await expect(
          page.getByRole("heading", { name: /still being built/i }),
        ).toBeVisible();
      });
    }
  });
}

/*
 * Safari keeps links out of the Tab order unless the user turns on "Press Tab
 * to highlight each item on a webpage", which is off by default and is a
 * browser preference no markup can override. Pressing Tab in WebKit therefore
 * walks form controls only, and this site has none.
 *
 * So the assertion is split by what each engine can actually demonstrate. On
 * Chromium and Firefox the Tab order is walked for real. On WebKit the same
 * property is asserted the only way the platform permits: every link is
 * focusable and none has been removed from the tab order, which is the part
 * this site controls. Keyboard users on Safari reach these links either by
 * enabling that preference or through VoiceOver, which navigates links
 * regardless of it.
 *
 * The alternative — dropping WebKit from the keyboard tests — would have left
 * the engine every iOS visitor uses with no keyboard coverage at all.
 */
test.describe("reachable without a pointer", () => {
  test("every attraction can be focused and opened by keyboard alone", async ({
    page,
    browserName,
  }) => {
    await page.goto("/");

    if (browserName === "webkit") {
      for (const attraction of ATTRACTIONS) {
        const link = directoryLink(page, attraction.name);
        await expect(link).not.toHaveAttribute("tabindex", "-1");
        await link.focus();
        await expect(link).toBeFocused();
      }
      return;
    }

    // Tab through the document, collecting the hrefs that receive focus. The
    // skip link comes first; the directory's links follow in park order.
    const focused: string[] = [];
    for (let i = 0; i < ATTRACTIONS.length + 4; i += 1) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() =>
        document.activeElement instanceof HTMLAnchorElement
          ? new URL(document.activeElement.href).pathname
          : null,
      );
      if (href) focused.push(href);
    }

    for (const attraction of ATTRACTIONS) {
      expect(
        focused,
        `${attraction.slug} should be reachable by Tab`,
      ).toContain(`/${attraction.slug}`);
    }
  });

  test("the skip link is the first thing a keyboard reaches", async ({
    page,
    browserName,
  }) => {
    await page.goto("/");
    const skipLink = page.getByRole("link", { name: /skip to content/i });

    if (browserName === "webkit") {
      await expect(skipLink).toHaveAttribute("href", "#main");
      await skipLink.focus();
      await expect(skipLink).toBeFocused();
      return;
    }

    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
  });

  test("the skip link target exists on every route", async ({ page }) => {
    // The skip link is only worth having if it lands somewhere. Asserted for
    // every route, in every engine, since this part is markup and not a
    // browser preference.
    for (const slug of ["", ...ATTRACTIONS.map((a) => a.slug), ENTRANCE.slug]) {
      await page.goto(`/${slug}`);
      await expect(page.locator("#main")).toHaveCount(1);
    }
  });
});

test.describe("reachable without JavaScript", () => {
  // The park is a WebGL navigation layer; this is the guarantee that it is a
  // layer and not the only way in.
  test.use({ javaScriptEnabled: false });

  test("the directory still lists and links every attraction", async ({ page }) => {
    await page.goto("/");
    await expectDirectoryListsEveryAttraction(page);
  });

  test("each attraction page renders its content server-side", async ({ page }) => {
    for (const attraction of ATTRACTIONS) {
      await page.goto(`/${attraction.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        attraction.name,
      );
    }
  });

  test("the entrance renders", async ({ page }) => {
    // The entrance's heading is the person, not the park's label for the
    // destination. "the entrance" is what the pin and the directory call it;
    // the page itself is an about page and says whose it is.
    await page.goto(`/${ENTRANCE.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      PROFILE.name,
    );
  });
});
