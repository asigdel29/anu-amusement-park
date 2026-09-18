/**
 * Social card for the `fortune_booth` attraction.
 *
 * Composed by the shared generator so the card, the pin and the page cannot
 * disagree — see src/design/ogImage.tsx.
 */

import { parkCard, OG_SIZE, OG_CONTENT_TYPE } from "@/design/ogImage";
import { attractionBySlug } from "@/content/attractions";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "fortune booth — debugging reality";

export default function Image() {
  const attraction = attractionBySlug("fortune");
  return parkCard({
    title: attraction.name,
    description: attraction.tagline,
    accent: attraction.accent,
    note:
      attraction.status === "under-construction"
        ? "this ride is still being built"
        : undefined,
  });
}
