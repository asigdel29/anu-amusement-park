/**
 * Root layout. Establishes the document, the font bindings and the site-wide
 * metadata; renders no chrome of its own.
 *
 * Contract: every route in this application is a child of this layout and may
 * therefore assume the design tokens, both typefaces and a skip link are present.
 *
 * Deliberately not here: a header or navigation bar. The park at `/` is the
 * navigation, and each content route renders its own way back. A persistent chrome
 * bar would sit on top of the park canvas and cover the pins it exists to replace.
 */

import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/design/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://park.anubhavsigdel.com"),
  title: {
    default: "debugging reality",
    template: "%s · debugging reality",
  },
  description:
    "An amusement park of things Anubhav Sigdel has built. Rides may break in production.",
  openGraph: {
    type: "website",
    siteName: "debugging reality",
  },
};

/**
 * `themeColor` matches --surface-ground so mobile browser chrome does not flash a
 * light bar above a near-black page during navigation. `userScalable` is left at
 * its default: pinch-zoom is an accessibility feature and is never disabled, not
 * even over the park canvas, which handles its own pinch gesture separately.
 */
export const viewport: Viewport = {
  themeColor: "#08070d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a className="skip-link" href="#main">
          skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
