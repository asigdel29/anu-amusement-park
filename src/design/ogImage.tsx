/**
 * ogImage.tsx — the shared social-card generator.
 *
 * Contract: `parkCard` renders a 1200x630 card carrying a title, a line of
 * description and an accent rule. Every route's `opengraph-image.tsx` calls
 * this rather than composing its own, so a card cannot disagree with the
 * attraction it represents.
 *
 * The accent comes from `src/design/palette.ts` rather than from CSS: an
 * `ImageResponse` renders on the server with no stylesheet and no custom
 * properties, so `var(--neon-cyan)` would silently produce a transparent rule.
 * That module is asserted against tokens.css by tests/tokens.test.ts, so the
 * card cannot ship a colour the site no longer uses — which it could when this
 * file carried its own copy of the hexes.
 *
 * No custom font is loaded. Doing so means fetching a font file at render
 * time, and the card's job is to be legible in a link preview rather than
 * typographically exact — a font fetch that failed would produce no card at
 * all, which is worse than a card in the default face.
 */

import { ImageResponse } from "next/og";
import type { AccentToken, Attraction } from "@/content/attractions";
import { attractionBySlug } from "@/content/attractions";
import { ACCENTS, SURFACES } from "./palette";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";


export function parkCard({
  title,
  description,
  accent,
  note,
}: {
  title: string;
  description: string;
  accent: AccentToken;
  note?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: SURFACES["surface-ground"],
          padding: "80px",
        }}
      >
        <div
          style={{
            width: "96px",
            height: "8px",
            borderRadius: "4px",
            background: ACCENTS[accent],
            marginBottom: "40px",
          }}
        />
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            color: SURFACES["text-primary"],
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 34, color: SURFACES["text-muted"], marginTop: "24px" }}>
          {description}
        </div>
        {note && (
          <div style={{ fontSize: 26, color: ACCENTS[accent], marginTop: "28px" }}>
            {note}
          </div>
        )}
        <div style={{ fontSize: 24, color: SURFACES["text-muted"], marginTop: "auto" }}>
          debugging reality · rides may break in production
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/**
 * The social card for one attraction, and the exports its route file needs.
 *
 * Every attraction's `opengraph-image.tsx` was a 26-line copy of every other,
 * differing only in a slug — including seven copies of the under-construction
 * ternary and seven hand-typed `alt` strings that duplicated `attraction.name`
 * three lines below the call that already had it. Renaming an attraction
 * updated the pin, the page heading, the metadata title and the card body, and
 * silently left seven `alt` strings stale with nothing asserting them.
 *
 * Derived here instead, so a route file is a slug and three re-exports.
 */
export function attractionCard(slug: string) {
  const attraction: Attraction = attractionBySlug(slug);
  return {
    size: OG_SIZE,
    contentType: OG_CONTENT_TYPE,
    alt: `${attraction.name} — debugging reality`,
    Image: () =>
      parkCard({
        title: attraction.name,
        description: attraction.tagline,
        accent: attraction.accent,
        note:
          attraction.status === "under-construction"
            ? "this ride is still being built"
            : undefined,
      }),
  };
}
