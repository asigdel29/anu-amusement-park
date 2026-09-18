/**
 * Contract tests for the ported content.
 *
 * These guard the joins, not the prose. Whether a bio reads well is a human
 * judgement; whether a project is assigned to an attraction that exists, or a
 * fortune quotes copy that is actually on the site, is not — and both fail
 * silently. A project pointing at a misspelled attraction id simply vanishes
 * from every page rather than raising anything.
 */

import { describe, expect, it } from "vitest";
import { ATTRACTIONS } from "@/content/attractions";
import { PROJECTS, projectsFor } from "@/content/projects";
import { BOOKS } from "@/content/books";
import { LINKS } from "@/content/links";
import { PROFILE } from "@/content/profile";
import { FORTUNES } from "@/content/fortunes";
import { parseEmphasis, parseLine, parseSection } from "@/content/prose";

describe("projects are exhibited somewhere real", () => {
  it("assigns every project to an attraction that exists", () => {
    // A misspelled id drops the project from the site without any error.
    const ids = new Set(ATTRACTIONS.map((a) => a.id));
    for (const project of PROJECTS) {
      expect(ids, `${project.slug} -> ${project.attraction}`).toContain(
        project.attraction,
      );
    }
  });

  it("exhibits every project on some attraction's page", () => {
    // The reverse: a project assigned to a real attraction whose page does not
    // call projectsFor would also be invisible.
    const exhibited = new Set(
      ATTRACTIONS.flatMap((a) => projectsFor(a.id)).map((p) => p.slug),
    );
    for (const project of PROJECTS) {
      expect(exhibited, project.slug).toContain(project.slug);
    }
  });

  it("gives every open attraction either content or an honest status", () => {
    // An attraction marked open with nothing on it is the one combination that
    // produces a page claiming to be finished and showing nothing.
    for (const attraction of ATTRACTIONS) {
      if (attraction.status !== "open") continue;
      const hasProjects = projectsFor(attraction.id).length > 0;
      const hasOwnContent = ["the_library", "fortune_booth", "launch_tower"].includes(
        attraction.id,
      );
      expect(
        hasProjects || hasOwnContent,
        `${attraction.id} is marked open but has nothing to show`,
      ).toBe(true);
    }
  });

  it("uses unique slugs and absolute urls", () => {
    const slugs = PROJECTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const project of PROJECTS) {
      expect(() => new URL(project.url)).not.toThrow();
      expect(project.url).toMatch(/^https:/);
    }
  });
});

describe("the library's contents", () => {
  it("has a complete record per book", () => {
    for (const book of BOOKS) {
      expect(book.title.length).toBeGreaterThan(0);
      expect(book.author.length).toBeGreaterThan(0);
      expect(book.summary.length).toBeGreaterThan(0);
      // The spine is rendered as a raw background colour, so it has to be one.
      expect(book.spine).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has unique, absolute, https link urls", () => {
    const urls = LINKS.map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const link of LINKS) {
      expect(() => new URL(link.url)).not.toThrow();
      expect(link.url).toMatch(/^https:/);
    }
  });

  it("still carries the source's unverified flags", () => {
    // The previous site flagged three URLs as best-guess matches from a search
    // rather than links anyone had followed. Losing the flags in the port would
    // silently promote three guesses to facts.
    expect(LINKS.filter((l) => l.unverified)).toHaveLength(3);
  });
});

describe("the fortune deck quotes the site", () => {
  it("draws every fortune from copy that is actually in PROFILE", () => {
    // The booth exhibits opinions already on the site. Without this the deck
    // would quietly become its own separate body of copy, saying things no
    // other page says.
    const profileLines = PROFILE.sections
      .flatMap((section) => section.lines)
      .map((line) => line.replace(/^\s*-\s+/, "").trim());

    for (const fortune of FORTUNES) {
      expect(profileLines, fortune).toContain(fortune.trim());
    }
  });

  it("has enough fortunes for a draw to always change something", () => {
    // The booth picks from the other fortunes only, which needs at least two.
    expect(FORTUNES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(FORTUNES).size).toBe(FORTUNES.length);
  });
});

describe("the prose conventions", () => {
  it("splits emphasis on paired asterisks", () => {
    expect(parseEmphasis("founding team at *lora*.")).toEqual([
      { text: "founding team at ", emphasis: false },
      { text: "lora", emphasis: true },
      { text: ".", emphasis: false },
    ]);
  });

  it("leaves an unpaired asterisk as literal text", () => {
    // A greedy parser treating every asterisk as an opening marker would
    // swallow the rest of the paragraph into an emphasis that never closes.
    expect(parseEmphasis("a * b")).toEqual([{ text: "a * b", emphasis: false }]);
  });

  it("never returns an empty run list", () => {
    // An empty result renders as a missing line rather than as an empty one.
    expect(parseEmphasis("")).toHaveLength(1);
    expect(parseEmphasis("**")).toHaveLength(1);
  });

  it("recognises an indented list marker", () => {
    // The source copy indents its bullets. An exact match on "- " would
    // classify every one of them as a paragraph.
    expect(parseLine(" - be okay with being wrong.").kind).toBe("item");
    expect(parseLine("- no indent").kind).toBe("item");
    expect(parseLine("not a list - with a dash").kind).toBe("paragraph");
  });

  it("groups consecutive items into one list", () => {
    // Six single-item lists are announced as "list, one item" six times, which
    // is materially worse than "list, six items" for exactly the content that
    // most wants to be heard as a list.
    const blocks = parseSection({
      header: "x",
      lines: ["intro", " - one", " - two", " - three", "outro"],
    });
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "list", "paragraph"]);
    expect(blocks[1].lines).toHaveLength(3);
  });

  it("keeps each paragraph its own block", () => {
    const blocks = parseSection({ header: "x", lines: ["one", "two"] });
    expect(blocks).toHaveLength(2);
  });

  it("parses every section of the real profile without loss", () => {
    for (const section of PROFILE.sections) {
      const blocks = parseSection(section);
      const rendered = blocks.flatMap((b) => b.lines).length;
      expect(rendered, section.header).toBe(section.lines.length);
    }
  });
});
