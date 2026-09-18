/**
 * launch tower — content page for the `launch_tower` attraction.
 *
 * The attraction's identity (name, tagline, accent, status) comes from
 * src/content/attractions.ts; this file supplies only what is exhibited here.
 * Metadata is derived from the same record, so the page title, the pin label
 * and the directory entry cannot disagree.
 */

import type { Metadata } from "next";
import { AttractionLayout } from "@/design/AttractionLayout";
import { attractionBySlug } from "@/content/attractions";
import { ProjectList } from "@/design/ContentList";
import { PROJECTS } from "@/content/projects";
import { PROFILE } from "@/content/profile";
import { Prose } from "@/design/Prose";

const attraction = attractionBySlug("launch");

export const metadata: Metadata = {
  title: attraction.name,
  description: attraction.tagline,
};

export default function Page() {
  return (
    <AttractionLayout attraction={attraction}>
      {/* The tower is the whole manifest rather than one attraction's
          exhibit: it is where a visitor goes to see what is shipping, so it
          lists every project in the park and points at each one's own ride. */}
      <Prose sections={[PROFILE.sections[0]]} />
      <h2>everything currently standing</h2>
      <ProjectList projects={PROJECTS} />
    </AttractionLayout>
  );
}
