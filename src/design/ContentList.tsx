/**
 * The three list shapes the attraction pages need: projects, books and links.
 *
 * Contract: each component renders its content as a semantic `<ul>` of titled
 * entries. Entries with a destination are links; entries without are plain
 * text, never a link to nowhere.
 *
 * One module and one stylesheet for all three, because all three are the same
 * thing — a titled row with a line of description. Three near-identical
 * components would have drifted apart within a week, and the difference
 * between them is which fields exist, not how they look.
 *
 * External links carry `rel="noreferrer"` alongside `target="_blank"`. Without
 * it the opened page can reach back through `window.opener`, and every link on
 * these pages is to somewhere this site does not control.
 */

import type { Book } from "@/content/books";
import type { Link as LinkRecord } from "@/content/links";
import type { Project } from "@/content/projects";
import styles from "./ContentList.module.css";

/** Every outbound link on these pages goes somewhere this site does not own. */
const EXTERNAL = { target: "_blank", rel: "noreferrer" } as const;

export function ProjectList({ projects }: { projects: readonly Project[] }) {
  if (projects.length === 0) return null;

  return (
    <ul className={styles.list}>
      {projects.map((project) => (
        <li key={project.slug} className={styles.entry}>
          <a className={styles.title} href={project.url} {...EXTERNAL}>
            {project.name}
          </a>
          <p className={styles.blurb}>{project.blurb}</p>
          {project.detail.map((line) => (
            <p key={line} className={styles.detail}>
              {line}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function BookList({ books }: { books: readonly Book[] }) {
  return (
    <ul className={styles.list}>
      {books.map((book) => (
        <li key={book.title} className={styles.entry}>
          {/* A book has no URL, so its title is text rather than a dead link. */}
          <span className={styles.title}>{book.title}</span>
          <span className={styles.meta}>{book.author}</span>
          <p className={styles.blurb}>{book.summary}</p>
          <span
            className={styles.spine}
            style={{ background: book.spine }}
            aria-hidden="true"
          />
        </li>
      ))}
    </ul>
  );
}

export function LinkList({ links }: { links: readonly LinkRecord[] }) {
  return (
    <ul className={styles.list}>
      {links.map((link) => (
        <li key={link.url} className={styles.entry}>
          <a className={styles.title} href={link.url} {...EXTERNAL}>
            {link.title}
          </a>
          {link.unverified && (
            <span className={styles.unverified}>
              link unverified — may not point at the exact piece
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
