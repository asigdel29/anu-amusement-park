/**
 * prose.ts — the shape all of this site's written content takes, and the two
 * conventions its source text carries.
 *
 * Contract: content is a list of `Section`s, each a heading plus lines. Two
 * conventions are honoured when rendering a line, both inherited from the
 * copy as it was originally written:
 *
 *   1. `*asterisk-wrapped*` spans are emphasis.
 *   2. A line beginning `- ` is a list item.
 *
 * Both are parsed here into structured values rather than interpreted at the
 * point of rendering, so the renderer never touches raw strings and the
 * conventions have one definition.
 *
 * Requires of callers: pass the line exactly as authored. Trimming or
 * normalising first would defeat the list detection, which depends on the
 * leading marker.
 *
 * Why parse at all rather than store markup: the copy is authored as plain
 * strings and always has been. Storing HTML would make every future edit a
 * markup edit, and would put an injection surface into content that has no
 * reason to carry one — these parsers cannot emit an element the renderer did
 * not already intend to create.
 */

/** One heading and the lines beneath it. */
export interface Section {
  readonly header: string;
  readonly lines: readonly string[];
}

/** A run of text, emphasised or not. */
export interface TextRun {
  readonly text: string;
  readonly emphasis: boolean;
}

/**
 * Splits a line into emphasised and plain runs on `*...*` pairs.
 *
 * An unpaired asterisk is left as literal text rather than treated as an
 * opening marker that never closes. The copy contains apostrophes and
 * quotation marks in the same lines as emphasis, and a greedy parser that
 * assumed every asterisk opened a span would swallow the rest of a paragraph.
 */
export function parseEmphasis(line: string): readonly TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /\*([^*]+)\*/g;
  let index = 0;

  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (match.index > index) {
      runs.push({ text: line.slice(index, match.index), emphasis: false });
    }
    runs.push({ text: match[1], emphasis: true });
    index = match.index + match[0].length;
  }

  if (index < line.length) {
    runs.push({ text: line.slice(index), emphasis: false });
  }

  // A line that is entirely one emphasised span, or entirely plain, still
  // yields at least one run — an empty result would render as a missing line.
  return runs.length > 0 ? runs : [{ text: line, emphasis: false }];
}

/** A line's classification, after the list marker has been stripped. */
export interface ParsedLine {
  readonly kind: "item" | "paragraph";
  readonly runs: readonly TextRun[];
}

/**
 * Classifies one line and parses its emphasis.
 *
 * The marker is matched with leading whitespace allowed, because the source
 * copy indents its list items (` - founding team at *lora*.`) and an exact
 * match on `- ` would classify every one of them as a paragraph.
 */
export function parseLine(line: string): ParsedLine {
  const item = /^\s*-\s+(.*)$/.exec(line);
  if (item) {
    return { kind: "item", runs: parseEmphasis(item[1]) };
  }
  return { kind: "paragraph", runs: parseEmphasis(line) };
}

/**
 * Groups a section's lines into runs of consecutive paragraphs and lists.
 *
 * Grouping is what lets consecutive items become one `<ul>` rather than six
 * single-item lists. A screen reader announces "list, six items" for the
 * former and "list, one item" six times for the latter, which is materially
 * worse for exactly the content — the six-bullet bio, the principles — that
 * most wants to be heard as a list.
 */
export interface Block {
  readonly kind: "list" | "paragraph";
  readonly lines: readonly (readonly TextRun[])[];
}

export function parseSection(section: Section): readonly Block[] {
  const blocks: Block[] = [];

  for (const line of section.lines) {
    const parsed = parseLine(line);
    const wanted = parsed.kind === "item" ? "list" : "paragraph";
    const last = blocks.at(-1);

    // Paragraphs are never merged: each is its own block, so each renders as
    // its own <p>. Only list items accumulate.
    if (wanted === "list" && last?.kind === "list") {
      blocks[blocks.length - 1] = {
        kind: "list",
        lines: [...last.lines, parsed.runs],
      };
    } else {
      blocks.push({ kind: wanted, lines: [parsed.runs] });
    }
  }

  return blocks;
}
