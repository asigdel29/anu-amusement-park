"use client";

/**
 * ParkMount — the client boundary the park is loaded across.
 *
 * Contract: renders nothing on the server and nothing until the park's chunk
 * has arrived, then mounts it over the page.
 *
 * This file exists for one reason: `next/dynamic` with `ssr: false` is only
 * permitted inside a Client Component, and `app/page.tsx` is deliberately a
 * Server Component so its directory is server-rendered. Without this boundary,
 * making the park client-only would mean making the whole page client-only —
 * and the page's server-rendered content is the site's accessibility substrate.
 *
 * `loading` is deliberately empty rather than a spinner. The page has already
 * painted its content; covering it with a loading state would hide a usable
 * site to announce that a decorative layer is on its way.
 */

import dynamic from "next/dynamic";

const Park = dynamic(() => import("./Park").then((m) => m.Park), {
  ssr: false,
  loading: () => null,
});

export function ParkMount() {
  return <Park />;
}
