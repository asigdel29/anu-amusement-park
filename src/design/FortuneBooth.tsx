"use client";

/**
 * FortuneBooth — one unsolicited opinion per visit.
 *
 * Contract: shows one line drawn from the fortune deck, and a control to draw
 * another. Server-renders the first fortune so the page is never empty and is
 * complete with JavaScript disabled; the draw control is progressive
 * enhancement on top of that.
 *
 * The deck is `PROFILE`'s own principles and interests — the opinions already
 * in the copy — rather than newly written ones. There is no model call here
 * and no API: a fortune booth that needed a server round trip to produce a
 * sentence someone already wrote would be a worse booth.
 *
 * Invariants:
 *   - The first fortune is deterministic, so the server and the client agree
 *     on it and hydration does not mismatch. Randomness starts at the first
 *     draw, which is a user action and therefore client-only by definition.
 *   - A draw never repeats the fortune currently showing. Pressing the button
 *     and seeing no change reads as a broken button, not as a coincidence.
 *   - The fortune is announced to assistive technology when it changes, since
 *     a visitor who cannot see the text swap would otherwise get no feedback
 *     from pressing the button at all.
 */

import { useCallback, useState } from "react";
import { FORTUNES } from "@/content/fortunes";
import { parseEmphasis } from "@/content/prose";
import styles from "./FortuneBooth.module.css";

export function FortuneBooth() {
  const [index, setIndex] = useState(0);

  const draw = useCallback(() => {
    setIndex((current) => {
      if (FORTUNES.length < 2) return current;
      // Draw from the other fortunes only, so a draw always visibly changes
      // something. Picking uniformly and retrying on a match would usually
      // work and occasionally not, which is the worse kind of usually.
      const offset = 1 + Math.floor(Math.random() * (FORTUNES.length - 1));
      return (current + offset) % FORTUNES.length;
    });
  }, []);

  const runs = parseEmphasis(FORTUNES[index]);

  return (
    <div className={styles.booth}>
      <p className={styles.fortune} aria-live="polite">
        {runs.map((run, i) =>
          run.emphasis ? (
            <em key={i} className={styles.emphasis}>
              {run.text}
            </em>
          ) : (
            <span key={i}>{run.text}</span>
          ),
        )}
      </p>

      <button type="button" className={styles.draw} onClick={draw}>
        another one
      </button>

      <p className={styles.note}>
        {FORTUNES.length} opinions in the machine. none of them are advice.
      </p>
    </div>
  );
}
