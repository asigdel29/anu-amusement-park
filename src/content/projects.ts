/**
 * projects.ts — the things that have been built.
 *
 * Ported from the previous site, where these were keyed "one" through "four"
 * after the four picture frames on a wall. Keyed by slug here: a positional
 * name was a property of that room's geometry, not of the work, and it made
 * every reference to a project unreadable.
 *
 * `attraction` is the id of the attraction whose page a project appears on.
 * It is asserted against ATTRACTIONS by tests/content.test.ts, so a project
 * cannot be assigned to a ride that does not exist — which would silently drop
 * it from the site rather than fail.
 */

export interface Project {
  readonly slug: string;
  readonly name: string;
  readonly blurb: string;
  readonly detail: readonly string[];
  readonly url: string;
  /** The attraction id this project is exhibited at. */
  readonly attraction: string;
}

export const PROJECTS: readonly Project[] = [
  {
    slug: "agent-canvas",
    name: "multiplayer ai agent canvas",
    blurb: "a multiplayer, infinite-canvas platform for running cloud ai agents, built on tldraw.",
    detail: [
      "spin up agents on a shared canvas and watch them work together in real time.",
    ],
    url: "https://agents.sigdel.world/",
    attraction: "agent_arcade",
  },
  {
    slug: "ai-native-sims-city",
    name: "ai native sims city",
    blurb: "an ai-native simcity — a living city simulation where the inhabitants are ai agents.",
    detail: ["watch the town come to life and see what the agents get up to."],
    url: "https://aiworld.sigdel.world/",
    attraction: "agent_arcade",
  },
  {
    slug: "coding-monkey",
    name: "coding-monkey",
    blurb: "an ai agent platform built in rust — fast, lean, and built for tinkering on agent workflows.",
    detail: [],
    url: "https://github.com/asigdel29/coding-monkey",
    attraction: "agent_arcade",
  },
  {
    slug: "matrixportfolio",
    name: "matrixportfolio",
    blurb: "a clean, reusable portfolio template for developers — fork it and make it your own.",
    detail: [],
    url: "https://github.com/asigdel29/matrixportfolio",
    attraction: "the_factory",
  },
];

/** The projects exhibited at one attraction, in declaration order. */
export function projectsFor(attractionId: string): readonly Project[] {
  return PROJECTS.filter((project) => project.attraction === attractionId);
}
