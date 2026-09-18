"use client";

/**
 * Park.tsx — the canvas, the pin layer, and the decision of whether to render
 * either at all.
 *
 * Contract: renders the 3D park over whatever the page already server-rendered,
 * or renders nothing at all if this browser cannot support it. Returning null
 * is a complete outcome, not a degraded one: the directory underneath is the
 * whole site and is fully functional.
 *
 * Requires of callers: mount from a Client Component. `next/dynamic` with
 * `ssr: false` is only permitted inside one, which is what `ParkMount` is for.
 *
 * Invariants:
 *   - WebGL support is probed, not assumed, and probed once. A context can fail
 *     to allocate on a blocklisted GPU or an out-of-memory machine even where
 *     the browser claims support.
 *   - The canvas is `aria-hidden` and not focusable. Every pin is also a link
 *     in the directory underneath, so exposing the canvas to a screen reader
 *     would announce the same seven destinations twice.
 *   - The fly-to duration is read from `--duration-fly`, so the reduced-motion
 *     branch is the token being zeroed rather than a condition in here. A
 *     zero-duration flight lands on its first frame and routes immediately.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PINNED_ATTRACTIONS, type PinnedAttraction } from "@/content/attractions";
import { ORBIT, fitDistance } from "./orbitRig";
import { cameraPosition, flightPlan } from "./flyTo";
import { ParkScene } from "./ParkScene";
import { startFlight } from "./flightStore";
import { Pins } from "./Pins";
import { pixelRatioRange, supportsWebGL } from "./capability";
import styles from "./Park.module.css";

/** Vertical field of view, in degrees. Shared with `fitDistance`. */
const FOV = 40;

/**
 * The orbit the park opens on.
 *
 * The distance is derived from the viewport rather than fixed, because how far
 * back the camera must sit to frame the park depends on the aspect ratio. A
 * constant tuned on a desktop cropped the island to its centre on a phone.
 */
function initialOrbit(): { azimuth: number; polar: number; distance: number } {
  const aspect =
    typeof window === "undefined" ? 1 : window.innerWidth / window.innerHeight;
  return { azimuth: 0, polar: 0.95, distance: fitDistance(aspect, FOV) };
}

/**
 * Reads a duration token from the document, in milliseconds.
 *
 * Going through the computed style rather than hard-coding 800 is what makes
 * `prefers-reduced-motion` work here: the token is zeroed in that media query,
 * so the camera cuts with no branch in this file. It also means the duration
 * has one declaration, in `tokens.css`, shared with every CSS transition.
 */
function durationToken(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return Number.parseFloat(raw) || 0;
  if (raw.endsWith("s")) return (Number.parseFloat(raw) || 0) * 1000;
  return fallback;
}

export function Park() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  // Measured once, at mount. The park does not reframe itself on a resize:
  // re-deriving the distance mid-session would yank the camera away from
  // wherever the visitor had put it, which is worse than a rotation leaving
  // the park slightly small until the next visit.
  const [orbit] = useState(initialOrbit);

  // Probed once, in the state initializer rather than in an effect. This module
  // is only ever loaded through `ParkMount`, which imports it with `ssr: false`,
  // so the initializer cannot run on the server — and doing it here avoids the
  // cascading render that probing in an effect would cause.
  const [webgl] = useState(supportsWebGL);

  const activate = useCallback(
    (attraction: PinnedAttraction) => {
      const href = `/${attraction.slug}`;
      const duration = durationToken("--duration-fly", 800);

      // Prefetched before the tween rather than after it, so the route is
      // already in flight while the camera moves. With a zero duration the
      // prefetch and the push happen back to back, which is the same thing a
      // plain link does.
      router.prefetch(href);

      if (duration <= 0) {
        // Under reduced motion there is no tween to run, so no frame would ever
        // fire the arrival callback. Route directly instead of recording a
        // flight nothing will complete.
        router.push(href);
        return;
      }

      startFlight(flightPlan(orbit, attraction.position, duration), () =>
        router.push(href),
      );
    },
    [router, orbit],
  );

  const onReady = useCallback(() => setReady(true), []);

  // Nothing at all, rather than a degraded park. The directory this would have
  // covered is the whole site and is fully functional.
  if (!webgl) return null;

  return (
    <div className={`${styles.stage} ${ready ? styles.ready : ""}`}>
      <Canvas
        className={styles.canvas}
        aria-hidden="true"
        tabIndex={-1}
        dpr={pixelRatioRange()}
        // The page's own background is the night sky. A transparent canvas
        // means the park sits on --surface-ground rather than on a second,
        // slightly-different black of its own.
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{
          fov: FOV,
          near: 1,
          // Far enough to keep the water plane in view at the greatest orbit
          // distance a portrait phone needs.
          far: 900,
          position: cameraPosition(orbit),
        }}
        onCreated={({ camera }) => camera.lookAt(...ORBIT.target)}
      >
        <ParkScene onReady={onReady} />
      </Canvas>

      <Pins
        attractions={PINNED_ATTRACTIONS}
        ready={ready}
        onActivate={activate}
      />
    </div>
  );
}

export default Park;
