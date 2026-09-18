"use client";

/**
 * Pins.tsx — the park's interface, and the only part of it that is not 3D.
 *
 * Contract: renders one DOM anchor per attraction. The render loop moves them
 * via `pinStore`; this component never positions them itself. Activating a pin
 * calls `onActivate`. The layer is inert to the pointer until `ready`.
 *
 * Requires of callers: mount this as a sibling of the canvas inside a
 * positioned container — not inside the R3F tree. It has to be ordinary DOM in
 * normal document flow for its labels to be real text.
 *
 * Why DOM rather than `Sprite` or drei's `Html`:
 *   - the labels are real text: selectable, translatable, read by a screen
 *     reader, and found by in-page search;
 *   - they are focusable, so the park is keyboard-navigable;
 *   - they are styled from the same tokens as the content pages, so the park
 *     and the pages cannot drift apart;
 *   - and they cost one transform write per pin per frame, nothing more.
 *
 * This is the reference's own technique, and it is why its map is navigable
 * rather than merely decorative.
 *
 * Invariants:
 *   - Every pin is a real anchor with a real href, so it works with no
 *     JavaScript, offers a context menu, and can be opened in a new tab.
 *   - A pin's hit area is never smaller than 44px however small it is drawn —
 *     the WCAG target-size floor and the reference's touch size.
 *   - Only a plain left-click is intercepted. A modifier-click is left to the
 *     browser, because a visitor who cmd-clicks wants a new tab and not a
 *     camera tween.
 */

import { useCallback } from "react";
import type { PinnedAttraction } from "./pinnedAttractions";
import { registerPinElement } from "./pinStore";
import styles from "./Pins.module.css";

export function Pins({
  attractions,
  ready,
  onActivate,
}: {
  attractions: readonly PinnedAttraction[];
  /** True once the park's assets have loaded and the pins should appear. */
  ready: boolean;
  onActivate: (attraction: PinnedAttraction) => void;
}) {
  const register = useCallback(
    (id: string) => (node: HTMLAnchorElement | null) =>
      registerPinElement(id, node),
    [],
  );

  return (
    <div className={`${styles.layer} ${ready ? styles.active : ""}`}>
      {attractions.map((attraction, index) => (
        <a
          key={attraction.id}
          ref={register(attraction.id)}
          href={`/${attraction.slug}`}
          className={styles.pin}
          style={
            {
              "--accent": `var(--${attraction.accent})`,
              // Pins pop in one after another rather than all at once, which is
              // how the reference draws the eye around its map on first load.
              "--delay": `calc(var(--stagger-pin) * ${index})`,
            } as React.CSSProperties
          }
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }
            event.preventDefault();
            onActivate(attraction);
          }}
        >
          <span className={styles.ring} aria-hidden="true" />
          <span className={styles.label}>
            {attraction.name}
            {attraction.status === "under-construction" && (
              <span className={styles.note}> · under construction</span>
            )}
          </span>
        </a>
      ))}
    </div>
  );
}
