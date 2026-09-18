/**
 * Robots policy.
 *
 * Everything is crawlable. The park is a WebGL layer over server-rendered
 * content, and that content is the site as far as a crawler is concerned —
 * which is the same path a screen reader and a no-JavaScript browser take. If
 * a crawler can read this site, the accessibility substrate is working.
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://park.anubhavsigdel.com/sitemap.xml",
  };
}
