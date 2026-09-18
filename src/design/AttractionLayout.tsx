/**
 * AttractionLayout — the chrome every attraction page shares.
 *
 * Contract: given an attraction, renders the `<main>` landmark, the page heading
 * and lede, the accent rule, the way back to the park, and an
 * under-construction notice when the attraction has no content yet. Children are
 * the attraction's own content and are rendered inside the landmark.
 *
 * Requires of callers: an `Attraction` from src/content/attractions.ts, obtained
 * via `attractionBySlug`. A page must not construct one inline, or the park would
 * have a pin whose colour and name disagree with the page it opens.
 *
 * Invariants:
 *   - exactly one `<h1>` per page, and it is the attraction's name;
 *   - the `#main` anchor the root layout's skip link targets exists on every page;
 *   - the accent is applied to the rule and heading only, never to body copy, so
 *     the one body-unsafe accent cannot make a page unreadable (tokens.css
 *     invariant 2);
 *   - the return link is a real anchor, so the park is reachable from any page
 *     without client JavaScript.
 */

import Link from "next/link";
import type { Attraction } from "@/content/attractions";
import styles from "./AttractionLayout.module.css";

export function AttractionLayout({
  attraction,
  children,
}: {
  attraction: Attraction;
  children?: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className={styles.page}
      style={{ "--accent": `var(--${attraction.accent})` } as React.CSSProperties}
    >
      <Link href="/" className={styles.back}>
        ← back to the park
      </Link>

      <header className={styles.header}>
        <h1>{attraction.name}</h1>
        <p className={styles.lede}>{attraction.tagline}</p>
        <hr className={styles.rule} />
      </header>

      {attraction.status === "under-construction" ? (
        <section className={styles.construction} aria-label="status">
          <h2>this ride is still being built</h2>
          <p>
            Nothing is here yet. It is listed anyway, because a park map that
            hides its unfinished rides is a worse map.
          </p>
        </section>
      ) : null}

      {children}
    </main>
  );
}
