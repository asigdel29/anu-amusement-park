/**
 * attractions.ts — the single source of truth for the park's navigation.
 *
 * Contract: `ATTRACTIONS` is the complete, ordered list of every destination in
 * the park. Three separate things read it and must agree:
 *
 *   1. the park's pin layer (src/park), which renders one pin per entry;
 *   2. the router, which must have a route directory matching every `slug`;
 *   3. the Blender build (assets/park_build.py), which must place one named empty
 *      per `id` and emit its world position into assets/pipeline/pins.json.
 *
 * Invariants, all asserted by tests/attractions.test.ts:
 *   - `id` and `slug` are unique across the list.
 *   - every `slug` has a directory `app/<slug>/page.tsx`.
 *   - every `accent` is a token declared in src/design/tokens.css.
 *   - an accent listed in LARGE_TEXT_ONLY is never used for an attraction whose
 *     page sets body copy in its accent colour.
 *   - once assets/pipeline/pins.json exists, its key set equals this list's id set.
 *
 * Positions deliberately do not appear here, and neither does the join that
 * reads them: `src/park/pinnedAttractions.ts` owns that, so a broken Blender export costs
 * the park rather than the whole site. See that module.
 *
 * `status` is load-bearing, not decoration. An attraction with no content yet says
 * so, on its own page and in its pin's label. Hiding an unfinished pin would make
 * the park smaller than the map it is modelled on; inventing content for it would
 * be worse.
 */

/** A token name from src/design/tokens.css, without the `--` prefix. */
export type AccentToken =
  | "neon-pink"
  | "neon-yellow"
  | "neon-cyan"
  | "neon-purple"
  | "neon-mint"
  | "neon-blue";

export type AttractionStatus = "open" | "under-construction";

export interface Attraction {
  /** Stable identifier. Matches the empty's name in assets/park_build.py. */
  readonly id: string;
  /** Route segment. A directory of this name must exist under app/. */
  readonly slug: string;
  /** The name on the pin and at the top of the page. */
  readonly name: string;
  /** One line, shown under the pin's name and as the page's lede. */
  readonly tagline: string;
  /** Drives the pin, the page's heading rule and the Blender signage alike. */
  readonly accent: AccentToken;
  readonly status: AttractionStatus;
}

export const ATTRACTIONS: readonly Attraction[] = [
  {
    id: "agent_arcade",
    slug: "arcade",
    name: "agent arcade",
    tagline: "ai projects and demos, most of them still plugged in",
    accent: "neon-cyan",
    status: "open",
  },
  {
    id: "the_factory",
    slug: "factory",
    name: "the factory",
    tagline: "engineering systems, architecture, and the tooling around them",
    accent: "neon-yellow",
    status: "open",
  },
  {
    id: "idea_graveyard",
    slug: "graveyard",
    name: "idea graveyard",
    tagline: "experiments that did not survive contact with reality",
    accent: "neon-purple",
    status: "under-construction",
  },
  {
    id: "the_library",
    slug: "library",
    name: "the library",
    tagline: "books, essays, and the reading that shaped the rest of this park",
    accent: "neon-mint",
    status: "open",
  },
  {
    id: "hardware_workshop",
    slug: "workshop",
    name: "hardware workshop",
    tagline: "robotic hands, cyberdecks, and things with solder on them",
    accent: "neon-pink",
    status: "under-construction",
  },
  {
    id: "launch_tower",
    slug: "launch",
    name: "launch tower",
    tagline: "what is shipping right now",
    accent: "neon-blue",
    status: "open",
  },
  {
    id: "fortune_booth",
    slug: "fortune",
    name: "fortune booth",
    tagline: "one unsolicited opinion per visit",
    accent: "neon-pink",
    status: "open",
  },
] as const;

/**
 * The park entrance. Separate from ATTRACTIONS because it is not a ride: it has a
 * page and a route but no pin of its own, being where a visitor arrives.
 */
export const ENTRANCE = {
  slug: "about",
  name: "the entrance",
  tagline: "who runs this place",
} as const;

/** Every route this site owns, entrance included. Used by sitemap and by tests. */
export const ALL_SLUGS: readonly string[] = [
  ENTRANCE.slug,
  ...ATTRACTIONS.map((a) => a.slug),
];

/** Throws rather than returning undefined: an unknown slug is a routing bug. */
export function attractionBySlug(slug: string): Attraction {
  const found = ATTRACTIONS.find((a) => a.slug === slug);
  if (!found) {
    throw new Error(
      `no attraction with slug ${JSON.stringify(slug)}; known slugs: ${ATTRACTIONS.map((a) => a.slug).join(", ")}`,
    );
  }
  return found;
}
