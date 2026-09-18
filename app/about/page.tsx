/**
 * The entrance — who runs the park.
 *
 * Not an attraction: it has a route and a page but no pin, being where a
 * visitor arrives rather than something they ride. It therefore does not use
 * `AttractionLayout`, which is keyed to an `Attraction` record and renders a
 * pin's accent.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ENTRANCE } from "@/content/attractions";
import { PROFILE } from "@/content/profile";
import { Prose, Runs } from "@/design/Prose";
import { parseEmphasis } from "@/content/prose";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: ENTRANCE.name,
  description: `${PROFILE.name} — ${ENTRANCE.tagline}.`,
};

export default function EntrancePage() {
  return (
    <main id="main" className={styles.page}>
      <Link href="/" className={styles.back}>
        ← back to the park
      </Link>

      <header className={styles.header}>
        <h1>{PROFILE.name}</h1>
        <p className={styles.intro}>
          <Runs runs={parseEmphasis(PROFILE.intro)} />
        </p>
        <ul className={styles.socials}>
          {PROFILE.socials.map((social) => (
            <li key={social.url}>
              <a href={social.url} target="_blank" rel="noreferrer">
                {social.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <Prose sections={PROFILE.sections} />
    </main>
  );
}
