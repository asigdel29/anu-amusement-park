/**
 * the library — content page for the `the_library` attraction.
 *
 * The attraction's identity (name, tagline, accent, status) comes from
 * src/content/attractions.ts; this file supplies only what is exhibited here.
 * Metadata is derived from the same record, so the page title, the pin label
 * and the directory entry cannot disagree.
 */

import type { Metadata } from "next";
import { AttractionLayout } from "@/design/AttractionLayout";
import { attractionBySlug } from "@/content/attractions";
import { BookList, LinkList } from "@/design/ContentList";
import { BOOKS } from "@/content/books";
import { LINKS } from "@/content/links";

const attraction = attractionBySlug("library");

export const metadata: Metadata = {
  title: attraction.name,
  description: attraction.tagline,
};

export default function Page() {
  return (
    <AttractionLayout attraction={attraction}>
      <h2>the shelf</h2>
      <BookList books={BOOKS} />

      <h2>essays worth keeping</h2>
      <LinkList links={LINKS} />
    </AttractionLayout>
  );
}
