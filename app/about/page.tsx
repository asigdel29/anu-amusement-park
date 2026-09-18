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
import { Prose } from "@/design/Prose";
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
          {parseEmphasis(PROFILE.intro).map((run, index) =>
            run.emphasis ? (
              <em key={index} className={styles.emphasis}>
                {run.text}
              </em>
            ) : (
              <span key={index}>{run.text}</span>
            ),
          )}
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
