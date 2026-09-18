/**
 * Sitemap, derived from the attraction list.
 *
 * Contract: one entry per route this site owns, generated from `ALL_SLUGS`.
 *
 * Derived rather than hand-maintained, because a hand-maintained sitemap is a
 * list that silently stops matching the site. Adding an attraction to
 * `ATTRACTIONS` gives it a pin, a directory entry, a route and a sitemap
 * entry; forgetting to touch this file is not one of the ways that can go
 * wrong.
 */

import type { MetadataRoute } from "next";
import { ALL_SLUGS } from "@/content/attractions";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "/", lastModified: now, priority: 1 },
    ...ALL_SLUGS.map((slug) => ({
      url: `/${slug}`,
      lastModified: now,
      priority: 0.8,
    })),
  ];
}
