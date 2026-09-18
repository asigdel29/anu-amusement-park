/**
 * Social card for `/fortune`. Composed by the shared generator so the card, the
 * pin and the page cannot disagree — see src/design/ogImage.tsx.
 */

import { attractionCard } from "@/design/ogImage";

const card = attractionCard("fortune");

export const { size, contentType, alt } = card;
export default card.Image;
