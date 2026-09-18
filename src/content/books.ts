/**
 * books.ts — the reading shelf, ported verbatim.
 *
 * `spine` is the flat block colour the previous site used to draw a book's
 * spine. It is kept because it is the only thing distinguishing one shelf
 * entry from another at a glance, and because these six colours were chosen
 * against each other rather than individually.
 *
 * Note they are NOT design-system tokens and must not be swapped for accents:
 * they identify books, not attractions, and they are decorative blocks rather
 * than text, so the palette's contrast rules do not apply to them.
 */

export interface Book {
  readonly title: string;
  readonly author: string;
  readonly summary: string;
  readonly spine: string;
}

export const BOOKS: readonly Book[] = [
  {
    title: "The Beginning of Infinity",
    author: "David Deutsch",
    summary:
      "why explanatory knowledge has unlimited reach — a case for optimism grounded in good explanations.",
    spine: "#3aa86f",
  },
  {
    title: "Gödel, Escher, Bach",
    author: "Douglas Hofstadter",
    summary:
      "strange loops and self-reference across math, art, and music — how minds emerge from formal systems.",
    spine: "#c8642f",
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    summary:
      "the two systems that drive how we think — and the biases that come baked into both.",
    spine: "#2f6fc8",
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    summary:
      "ecology, prophecy, and power on a desert world — the sci-fi epic that started it all.",
    spine: "#b58a2e",
  },
  {
    title: "Deep Work",
    author: "Cal Newport",
    summary:
      "focused, distraction-free work is a superpower — here's how to cultivate it.",
    spine: "#7a4fb5",
  },
  {
    title: "Snow Crash",
    author: "Neal Stephenson",
    summary:
      "the cyberpunk classic that coined the metaverse — language, viruses, and pizza delivery.",
    spine: "#2f9ec8",
  },
];
