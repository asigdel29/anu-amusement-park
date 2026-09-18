/**
 * ogImage.tsx — the shared social-card generator.
 *
 * Contract: `parkCard` renders a 1200x630 card carrying a title, a line of
 * description and an accent rule. Every route's `opengraph-image.tsx` calls
 * this rather than composing its own, so a card cannot disagree with the
 * attraction it represents.
 *
 * The accent is resolved from the token palette here rather than read from
 * CSS: an `ImageResponse` is rendered on the server with no stylesheet and no
 * custom properties, so `var(--neon-cyan)` would silently produce a
 * transparent rule. The values are duplicated for that reason and asserted
 * against tokens.css by tests/tokens.test.ts.
 *
 * No custom font is loaded. Doing so means fetching a font file at render
 * time, and the card's job is to be legible in a link preview rather than to
 * be typographically exact — a font fetch that fails would produce no card at
 * all, which is worse than a card in the default face.
 */

import { ImageResponse } from "next/og";
import type { AccentToken } from "@/content/attractions";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Mirrors src/design/tokens.css. See this module's note on why. */
const ACCENTS: Record<AccentToken, string> = {
  "neon-pink": "#ff3891",
  "neon-yellow": "#ffbf04",
  "neon-cyan": "#00c2ff",
  "neon-purple": "#ad00ff",
  "neon-mint": "#4ff29f",
  "neon-blue": "#38b7ff",
};

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
          background: "#08070d",
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
            color: "#f4f1ea",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 34, color: "#9a94ad", marginTop: "24px" }}>
          {description}
        </div>
        {note && (
          <div style={{ fontSize: 26, color: ACCENTS[accent], marginTop: "28px" }}>
            {note}
          </div>
        )}
        <div style={{ fontSize: 24, color: "#9a94ad", marginTop: "auto" }}>
          debugging reality · rides may break in production
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
