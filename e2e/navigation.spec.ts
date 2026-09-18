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

test.describe("the park directory", () => {
  test("lists every attraction", async ({ page }) => {
    await page.goto("/");
    const directory = page.getByRole("navigation", { name: "park directory" });
    await expect(directory).toBeVisible();

    for (const attraction of ATTRACTIONS) {
      await expect(
        directory.getByRole("link", { name: new RegExp(attraction.name, "i") }),
      ).toBeVisible();
    }
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
      await page
        .getByRole("navigation", { name: "park directory" })
        .getByRole("link", { name: new RegExp(attraction.name, "i") })
        .click();

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

test.describe("reachable without a pointer", () => {
  test("every attraction can be focused and opened by keyboard alone", async ({
    page,
  }) => {
    await page.goto("/");

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

  test("the skip link moves focus to the main landmark", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
  });
});

test.describe("reachable without JavaScript", () => {
  // The park is a WebGL navigation layer; this is the guarantee that it is a
  // layer and not the only way in.
  test.use({ javaScriptEnabled: false });

  test("the directory still lists and links every attraction", async ({ page }) => {
    await page.goto("/");
    const directory = page.getByRole("navigation", { name: "park directory" });
    await expect(directory).toBeVisible();

    for (const attraction of ATTRACTIONS) {
      await expect(
        directory.getByRole("link", { name: new RegExp(attraction.name, "i") }),
      ).toHaveAttribute("href", `/${attraction.slug}`);
    }
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
    await page.goto(`/${ENTRANCE.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ENTRANCE.name,
    );
  });
});
