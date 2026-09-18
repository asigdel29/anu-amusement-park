/**
 * park.ts — the selectors and shared expectations the e2e specs share.
 *
 * Contract: the one place that knows how to find the park's pins and the
 * directory. Not a fixture, just a module: the specs import from it.
 *
 * Why it exists: the pin selector is a CSS-Modules hash prefix, so it depends
 * on the *filename* `Pins.module.css`. It had been written out seven times
 * across three directories, twice inside `page.evaluate` bodies where the
 * typechecker cannot see it — so renaming that stylesheet would have broken
 * seven call sites, two of them silently. The directory's `aria-label` was in
 * five places with the same problem.
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { ATTRACTIONS } from "../src/content/attractions";

/** Every pin anchor in the park's DOM overlay. */
export const PIN_LINKS = '[class*="Pins-module"] a';

/** The pin layer, once the park has loaded and revealed it. */
export const PIN_LAYER_ACTIVE = '[class*="Pins-module"][class*="active"]';

/** The park's pins, as a locator. */
export function pins(page: Page): Locator {
  return page.locator(PIN_LINKS);
}

/** One attraction's pin. */
export function pin(page: Page, slug: string): Locator {
  return page.locator(`${PIN_LINKS}[href="/${slug}"]`);
}

/** The server-rendered directory beneath the park. */
export function directory(page: Page): Locator {
  return page.getByRole("navigation", { name: "park directory" });
}

/** One attraction's link in the directory. */
export function directoryLink(page: Page, name: string): Locator {
  return directory(page).getByRole("link", { name: new RegExp(name, "i") });
}

/**
 * Asserts the directory lists and links every attraction.
 *
 * The substrate guarantee, asserted identically by the navigation spec and the
 * no-WebGL spec — so it lives here rather than in both.
 */
export async function expectDirectoryListsEveryAttraction(page: Page) {
  await expect(directory(page)).toBeVisible();
  for (const attraction of ATTRACTIONS) {
    await expect(directoryLink(page, attraction.name)).toHaveAttribute(
      "href",
      `/${attraction.slug}`,
    );
  }
}
