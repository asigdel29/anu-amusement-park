/**
 * Social card for `/factory`. Composed by the shared generator so the card, the
 * pin and the page cannot disagree — see src/design/ogImage.tsx.
 */

import { attractionCard } from "@/design/ogImage";

const card = attractionCard("factory");

export const { size, contentType, alt } = card;
export default card.Image;
