/**
 * The park — this site's front door and its navigation layer.
 *
 * Contract: server-renders the park's name and its full directory. Once the 3D
 * layer lands (src/park), it mounts over this content from a client component,
 * and this markup remains underneath as the no-WebGL, no-pointer, no-JavaScript
 * path. This page itself stays a Server Component: `next/dynamic` with
 * `ssr: false` is only permitted inside a Client Component, so the park's mount
 * point will be a small client wrapper rather than a change to this file.
 *
 * Invariant: every attraction is reachable from here without executing any client
 * JavaScript. Verified by e2e/navigation.spec.ts with scripts disabled.
 */

import { ParkDirectory } from "@/design/ParkDirectory";
import styles from "./page.module.css";

export default function ParkPage() {
  return (
    <main id="main" className={styles.page}>
      <header className={styles.masthead}>
        <h1>debugging reality</h1>
        <p className={styles.subtitle}>rides may break in production</p>
      </header>
      <ParkDirectory />
    </main>
  );
}
