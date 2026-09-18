/**
 * agent arcade — content page for the `agent_arcade` attraction.
 *
 * The attraction's identity (name, tagline, accent, status) comes from
 * src/content/attractions.ts; this file supplies only the attraction's own
 * content. Metadata is derived from the same record so the page title, the pin
 * label and the directory entry cannot disagree.
 */

import type { Metadata } from "next";
import { AttractionLayout } from "@/design/AttractionLayout";
import { attractionBySlug } from "@/content/attractions";

const attraction = attractionBySlug("arcade");

export const metadata: Metadata = {
  title: attraction.name,
  description: attraction.tagline,
};

export default function Page() {
  return <AttractionLayout attraction={attraction} />;
}
