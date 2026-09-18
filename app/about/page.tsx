/**
 * The entrance — who runs the park.
 *
 * Not an attraction: it has a route and a page but no pin, being where a visitor
 * arrives rather than something they ride. It therefore does not use
 * AttractionLayout, which is keyed to an `Attraction` record.
 *
 * Content lands in M3, ported from anu-minecraft-world's `userManual` data.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ENTRANCE } from "@/content/attractions";

export const metadata: Metadata = {
  title: ENTRANCE.name,
  description: ENTRANCE.tagline,
};

export default function EntrancePage() {
  return (
    <main id="main" style={{ padding: "var(--grid-margin)" }}>
      <Link href="/">← back to the park</Link>
      <h1>{ENTRANCE.name}</h1>
      <p>{ENTRANCE.tagline}</p>
    </main>
  );
}
