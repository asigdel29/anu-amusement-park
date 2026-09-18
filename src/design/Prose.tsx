/**
 * Prose — renders the site's written content.
 *
 * Contract: given `Section`s, emits a heading per section and semantic markup
 * for its lines: consecutive list items become one `<ul>`, everything else a
 * `<p>`, and `*emphasis*` becomes `<em>`.
 *
 * Requires of callers: pass content straight from `src/content/*`. The parsing
 * lives in `src/content/prose.ts`, so this component never inspects a raw
 * string and never needs to know the conventions.
 *
 * Why this exists rather than storing markup in the content modules: the copy
 * has always been authored as plain strings, and it should stay that way.
 * Editing a bio should not mean editing HTML. It also means no content path
 * can inject an element — the parser emits runs of text, and this component
 * decides what elements exist.
 *
 * Invariant: section headings are `<h2>`, so a page keeps exactly one `<h1>`
 * (its own title, from `AttractionLayout`). Rendering headings at h1 here
 * would give every page as many first-level headings as it has sections, which
 * is the single most common way a document's outline becomes useless to a
 * screen reader.
 */

import type { Section, TextRun } from "@/content/prose";
import { parseSection } from "@/content/prose";
import styles from "./Prose.module.css";

/**
 * Renders parsed text runs, with `*emphasis*` spans as `<em>`.
 *
 * Exported because the fortune booth and the entrance render the same parsed
 * runs. Leaving it module-private meant this component and its `.emphasis`
 * rule were each written three times, and the rule carries a real constraint —
 * `--neon-mint` is used because the per-attraction accent varies and one of the
 * six fails AA for body text. Three hand-maintained copies of a contrast
 * decision is how one page quietly ends up with the unsafe one.
 */
export function Runs({ runs }: { runs: readonly TextRun[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.emphasis ? (
          <em key={index} className={styles.emphasis}>
            {run.text}
          </em>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}

export function Prose({ sections }: { sections: readonly Section[] }) {
  return (
    <div className={styles.prose}>
      {sections.map((section) => (
        <section key={section.header}>
          <h2>{section.header}</h2>
          {parseSection(section).map((block, index) =>
            block.kind === "list" ? (
              <ul key={index}>
                {block.lines.map((runs, line) => (
                  <li key={line}>
                    <Runs runs={runs} />
                  </li>
                ))}
              </ul>
            ) : (
              block.lines.map((runs, line) => (
                <p key={`${index}-${line}`}>
                  <Runs runs={runs} />
                </p>
              ))
            ),
          )}
        </section>
      ))}
    </div>
  );
}
