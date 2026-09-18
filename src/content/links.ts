/**
 * links.ts — essays and articles worth keeping, ported verbatim.
 *
 * The source carried `(verify)` notes against three of these, flagging URLs
 * that were best-guess matches from a search rather than links that had been
 * followed. The notes are preserved as `unverified` rather than dropped: the
 * uncertainty is real, and a flag that survives the port is the only thing
 * that will ever prompt anyone to resolve it.
 */

export interface Link {
  readonly title: string;
  readonly url: string;
  /** True where the source flagged the URL as an unconfirmed match. */
  readonly unverified?: boolean;
}

export const LINKS: readonly Link[] = [
  {
    title: "21 lessons for the 21st century",
    url: "https://www.ynharari.com/book/21-lessons-book/",
  },
  {
    title: "effective altruism in the garden of ends",
    url: "https://www.lesswrong.com/posts/YDHRa5cmKQCLGrCWj/effective-altruism-in-the-garden-of-ends",
  },
  {
    title: "the new war on asian american excellence",
    url: "https://garryslist.org/posts/the-new-war-on-asian-american-excellence",
  },
  {
    title: "cognitive security",
    url: "https://www.lesswrong.com/posts/KGcE7eAdfxHchk25X/cognitive-security-as-an-ai-safety-cause-area",
    unverified: true,
  },
  {
    title: "rightness is a prison",
    url: "https://usefulfictions.substack.com/p/rightness-is-a-prison",
  },
  {
    title: "ftc: protect your identity",
    url: "https://www.ftc.gov/media/5-ways-help-protect-your-identity",
    unverified: true,
  },
  {
    title: "how to be more agentic",
    url: "https://usefulfictions.substack.com/p/how-to-be-more-agentic",
  },
  {
    title: "how to prepare for the next decade",
    url: "https://thewakeupcallnewsletter.substack.com/p/how-to-prepare-for-the-next-decade",
    unverified: true,
  },
];
