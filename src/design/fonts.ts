/**
 * fonts.ts — the site's two typefaces, self-hosted at build time.
 *
 * Contract: exports one `fontVariables` string to be placed on <html>, which binds
 * `--font-changa` and `--font-work-sans`. src/design/tokens.css reads those two
 * variables and exposes them as `--font-display` and `--font-body`; no component
 * imports from this file directly.
 *
 * Why next/font rather than a stylesheet link: it downloads and serves the font
 * files from this origin at build time. Nothing is fetched from fonts.gstatic.com
 * at runtime, which is what lets the CSP in next.config.ts keep `font-src 'self'`
 * with no third-party exception — and it removes a render-blocking cross-origin
 * request on the critical path of every content page.
 *
 * Weights are pinned to exactly those the design system uses (tokens.css:
 * --weight-body 600, --weight-display 800). Requesting a weight not listed here
 * will silently synthesise it in the browser; add it here instead.
 */

import { Changa, Work_Sans } from "next/font/google";

const changa = Changa({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-changa",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

export const fontVariables = `${changa.variable} ${workSans.variable}`;
