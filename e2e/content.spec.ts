/**
 * End-to-end tests for the ported content.
 *
 * What these add over the unit suite: that the content actually reaches the
 * page. A unit test can assert a project is assigned to an attraction that
 * exists; only a browser can assert that the project's name appears on that
 * attraction's page, with a working link, in markup a crawler can read.
 *
 * Every assertion here runs with JavaScript disabled by default, because that
 * is the guarantee that matters for content: the park is a layer, and the
 * writing underneath it is the site.
 */

import { test, expect } from "@playwright/test";
import { ATTRACTIONS, ENTRANCE } from "../src/content/attractions";
import { PROJECTS, projectsFor } from "../src/content/projects";
import { BOOKS } from "../src/content/books";
import { LINKS } from "../src/content/links";
import { PROFILE } from "../src/content/profile";
import { FORTUNES } from "../src/content/fortunes";

test.describe("content is server-rendered", () => {
  test.use({ javaScriptEnabled: false });

  for (const attraction of ATTRACTIONS) {
    const projects = projectsFor(attraction.id);
    if (projects.length === 0) continue;

    test(`${attraction.name} exhibits its projects`, async ({ page }) => {
      await page.goto(`/${attraction.slug}`);
      for (const project of projects) {
        const link = page.getByRole("link", { name: project.name });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", project.url);
        // Opened in a new tab, and never with a reachable window.opener.
        await expect(link).toHaveAttribute("rel", "noreferrer");
        await expect(page.getByText(project.blurb)).toBeVisible();
      }
    });
  }

  test("the library shelves every book and essay", async ({ page }) => {
    await page.goto("/library");
    for (const book of BOOKS) {
      await expect(page.getByText(book.title, { exact: true })).toBeVisible();
      await expect(page.getByText(book.summary)).toBeVisible();
    }
    for (const link of LINKS) {
      await expect(
        page.getByRole("link", { name: link.title }),
      ).toHaveAttribute("href", link.url);
    }
  });

  test("the library flags its unverified links on the page", async ({ page }) => {
    // The flag is only worth carrying through the port if a reader sees it.
    await page.goto("/library");
    const flags = page.getByText(/link unverified/);
    await expect(flags).toHaveCount(LINKS.filter((l) => l.unverified).length);
  });

  test("the launch tower lists every project in the park", async ({ page }) => {
    await page.goto("/launch");
    for (const project of PROJECTS) {
      await expect(page.getByRole("link", { name: project.name })).toBeVisible();
    }
  });

  test("the entrance carries the bio, principles and socials", async ({ page }) => {
    await page.goto(`/${ENTRANCE.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PROFILE.name);

    for (const section of PROFILE.sections) {
      await expect(
        page.getByRole("heading", { name: section.header, level: 2 }),
      ).toBeVisible();
    }
    for (const social of PROFILE.socials) {
      await expect(
        page.getByRole("link", { name: social.label }),
      ).toHaveAttribute("href", social.url);
    }
  });

  test("the six-bullet bio is a real list, not six paragraphs", async ({ page }) => {
    // A screen reader announces "list, six items" for the former and "list,
    // one item" six times for the latter. This is the content that most wants
    // to be heard as a list.
    await page.goto(`/${ENTRANCE.slug}`);
    const bio = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /six-bullet bio/ }) });
    await expect(bio.getByRole("list")).toHaveCount(1);
    await expect(bio.getByRole("listitem")).toHaveCount(6);
  });

  test("the fortune booth shows an opinion without JavaScript", async ({ page }) => {
    // The first fortune is server-rendered, so the booth is never an empty
    // page waiting on a script.
    await page.goto("/fortune");
    await expect(page.getByText(FORTUNES[0].replaceAll("*", ""))).toBeVisible();
  });

  test("the sitemap lists every route", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = (await response?.text()) ?? "";
    for (const attraction of ATTRACTIONS) {
      expect(body, attraction.slug).toContain(`/${attraction.slug}`);
    }
    expect(body).toContain(`/${ENTRANCE.slug}`);
  });
});

test.describe("the fortune booth draws", () => {
  test("changes the fortune on every draw", async ({ page }) => {
    await page.goto("/fortune");
    const fortune = page.locator("[aria-live='polite']");
    const seen = new Set<string>();

    for (let i = 0; i < 6; i += 1) {
      const text = (await fortune.textContent()) ?? "";
      seen.add(text);
      const before = text;
      await page.getByRole("button", { name: /another one/i }).click();
      // A draw that left the text unchanged would read as a broken button.
      await expect(fortune).not.toHaveText(before);
    }

    expect(seen.size).toBeGreaterThan(1);
  });
});
