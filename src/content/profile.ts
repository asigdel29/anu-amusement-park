/**
 * profile.ts — who runs the park.
 *
 * Ported from the previous site's `about`, `userManual` and `info` modules,
 * which were three separate records describing one person. Merged here because
 * the split was an artefact of having three modals to fill, and the park has
 * one entrance.
 *
 * The `*emphasis*` markers are the source copy's own convention and are
 * preserved verbatim — see src/content/prose.ts. Do not strip them.
 */

import type { Section } from "./prose";

export const PROFILE = {
  name: "anubhav (anu)",
  intro: "welcome to what i like to call my *personal user manual* :d",

  socials: [
    { label: "substack", url: "https://sigdel29.substack.com" },
    { label: "x / twitter", url: "https://x.com/sigdel29" },
    { label: "linkedin", url: "https://www.linkedin.com/in/asigdel/" },
    { label: "github", url: "https://github.com/asigdel29" },
  ],

  sections: [
    {
      header: "about me",
      lines: [
        "hi, i'm anu :d this is my site! i build stuff",
        "i keep updating this site based on whatever i'm fascinated with at the moment, so it's less of a static portfolio and more of a living playground for my experiments.",
        "lately i've been deep in ai agents — building multiplayer agent tools and an ai-native city sim.",
      ],
    },
    {
      header: "🪪 the six-bullet bio",
      lines: [
        " - founding team at *lora*.",
        " - lifelong techno-optimist. previously a hedonist, more stoic now.",
        " - previously worked in it consultancy, then vr / metaverse, then ai b2b saas.",
        " - immigrant from *nepal*. moved to the usa in 2019 for higher education.",
        " - background in cognitive science, computer science, and biomedical health informatics.",
        " - engineer, film buff, wannabe philosopher.",
      ],
    },
    {
      header: "🧭 principles",
      lines: [
        ' - *"if you\'re not aiming to be the best at what you do, you\'re ngmi."*',
        " - be okay with being wrong.",
        " - never hold back.",
      ],
    },
    {
      header: "what i'm into",
      lines: [
        " - anything that would be science fiction years ago.",
        " - agents that can wow people.",
        " - multimodal hardware.",
      ],
    },
    {
      header: "📖 my story",
      lines: ["still writing this. ✍️"],
    },
  ] as const satisfies readonly Section[],
} as const;
