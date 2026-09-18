/**
 * ParkDirectory — the park's contents as a plain list of links.
 *
 * Contract: renders every entry in ATTRACTIONS as an anchor to its route, in park
 * order, using only server-rendered HTML. No client JavaScript, no WebGL, no
 * pointer events beyond a link.
 *
 * This is the accessibility backbone, not a fallback. It is what a screen reader
 * reads, what a crawler indexes, what a keyboard traverses, and what renders when
 * WebGL is unavailable — and it ships on the same page as the park rather than
 * behind a capability check, so it cannot rot while the 3D path is the one being
 * worked on. The park renders over it; this list stays beneath.
 *
 * Invariant: the set of links here equals the set of pins in the park. Both read
 * ATTRACTIONS, so they cannot disagree.
 */

import Link from "next/link";
import { ATTRACTIONS } from "@/content/attractions";
import styles from "./ParkDirectory.module.css";

export function ParkDirectory() {
  return (
    <nav aria-label="park directory" className={styles.directory}>
      <ul className={styles.list}>
        {ATTRACTIONS.map((attraction) => (
          <li key={attraction.id}>
            <Link
              href={`/${attraction.slug}`}
              className={styles.link}
              style={{ "--accent": `var(--${attraction.accent})` } as React.CSSProperties}
            >
              <span className={styles.name}>{attraction.name}</span>
              <span className={styles.tagline}>{attraction.tagline}</span>
              {attraction.status === "under-construction" && (
                <span className={styles.badge}>under construction</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
