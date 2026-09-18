/**
 * The park's own social card.
 *
 * Uses --neon-yellow, which is the subtitle's colour on the page itself, so a
 * link preview and the site it points at look like the same place.
 */

import { parkCard, OG_SIZE, OG_CONTENT_TYPE } from "@/design/ogImage";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "debugging reality — an amusement park of things anu has built";

export default function Image() {
  return parkCard({
    title: "debugging reality",
    description: "an amusement park of things i have built.",
    accent: "neon-yellow",
    note: "rides may break in production",
  });
}
