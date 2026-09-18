/**
 * The entrance's social card. Carries the person rather than the park, since
 * that is what the page is about.
 */

import { parkCard, OG_SIZE, OG_CONTENT_TYPE } from "@/design/ogImage";
import { ENTRANCE } from "@/content/attractions";
import { PROFILE } from "@/content/profile";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = `${PROFILE.name} — debugging reality`;

export default function Image() {
  return parkCard({
    title: PROFILE.name,
    description: ENTRANCE.tagline,
    accent: "neon-mint",
  });
}
