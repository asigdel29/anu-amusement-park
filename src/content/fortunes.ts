/**
 * fortunes.ts — the fortune booth's deck.
 *
 * Every line here is already in `PROFILE`: these are the principles and
 * interests as written, lifted out so the booth has a flat list to draw from.
 * Nothing in this file is newly invented — the booth exhibits opinions that
 * were already on the site rather than generating new ones.
 *
 * The `*emphasis*` markers are the source convention and are parsed by
 * src/content/prose.ts. Do not strip them.
 *
 * tests/content.test.ts asserts every line here appears in PROFILE, so the
 * deck cannot drift into being its own separate body of copy.
 */

export const FORTUNES: readonly string[] = [
  '*"if you\'re not aiming to be the best at what you do, you\'re ngmi."*',
  "be okay with being wrong.",
  "never hold back.",
  "anything that would be science fiction years ago.",
  "agents that can wow people.",
  "multimodal hardware.",
];
