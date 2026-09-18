"use client";

/**
 * ParkScene.tsx — everything that lives inside the canvas.
 *
 * Contract: renders the baked park, drives the orbit controls, projects each
 * pin's world position to screen space once per frame, and runs the fly-to
 * tween when one is requested. Calls `onReady` once the park is actually on
 * screen.
 *
 * Requires of callers: mount inside a `<Canvas>` and inside a Suspense
 * boundary. The flight in progress is read from `flightStore` rather than
 * received as a prop, so a new one is picked up without re-rendering the
 * canvas — a re-render mid-tween drops a frame at the moment it is most
 * visible. See that module on why it is a store and not a ref.
 *
 * Invariants:
 *   - The orbit controls' clamps come from `orbitRig` and are never set
 *     inline, so the camera's permitted band has one declaration.
 *   - While a flight is running, the controls are disabled. Two things driving
 *     one camera produces a fight that reads as stutter.
 *   - The projection pass writes through `pinStore` and never through React
 *     state. Seven pins at sixty frames a second is 420 state updates a second
 *     to move two numbers each.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PINNED_ATTRACTIONS } from "./pinnedAttractions";
import { ORBIT } from "./orbitRig";

/*
 * The orbit target, destructured once at module scope.
 *
 * `camera.lookAt(...ORBIT.target)` spread a readonly tuple on every frame of a
 * flight, which is the same per-frame allocation this file argues against for
 * the pins. Also hoisted for `touches` below: an object literal in JSX is a
 * fresh identity each render, so R3F re-applies `controls.touches` on every
 * reconcile — and the file's own invariant says the controls' settings are
 * never declared inline.
 */
const [TARGET_X, TARGET_Y, TARGET_Z] = ORBIT.target;

/**
 * One-finger orbit, two-finger zoom — the gesture set from every map app.
 *
 * Named through three's own `TOUCH` enum rather than written as the numbers
 * they happen to equal. This was `{ ONE: 1, TWO: 2 }`, which reads like
 * "one finger, two fingers" and is in fact `{ ONE: PAN, TWO: DOLLY_PAN }`:
 * `TOUCH` is `{ ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 }`. Since
 * `ORBIT.enablePan` is false, one finger was bound to a disabled action and
 * the park could not be orbited by touch at all — on a phone, the only way it
 * can be orbited.
 *
 * Nothing caught it: the e2e suite taps pins but never drags, and the latency
 * harness orbits with a mouse, which goes through `mouseButtons` instead.
 */
const TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN } as const;
import { useParkScene } from "./useGLTFUnlit";
import { writePinPosition } from "./pinStore";
import { cameraPosition, isComplete, orbitAt } from "./flyTo";
import { completeFlight, currentFlight, resetFlight } from "./flightStore";

export function ParkScene({ onReady }: { onReady: () => void }) {
  const scene = useParkScene();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera, size, invalidate } = useThree();

  /*
   * Hand vertical drags back to the browser.
   *
   * `OrbitControls.connect()` sets `domElement.style.touchAction = "none"` on
   * whatever element it listens to, unconditionally — so this cannot be
   * expressed in Park.module.css or in the <Canvas> `style` prop. Both are
   * overwritten at runtime, and both read as though they were in force.
   *
   * `none` is wrong here because the stage is fixed and fills the viewport:
   * that element is what a finger lands on everywhere on the page, so the
   * controls were taking every drag and the document could not be scrolled by
   * touch at all. The masthead is `min-height: 100dvh`, which puts the
   * directory below the fold on every phone — so the park was reachable and
   * the site underneath it was not. That is backwards; the directory is the
   * substrate and the park is a layer over it.
   *
   * `pan-y` returns vertical drags to the browser and keeps horizontal ones
   * for the orbit. Azimuth is the axis that spins the island, and the polar
   * angle is clamped to a 54-degree band regardless, so little is given up.
   * Two-finger gestures still reach the controls, because `pan-y` withholds
   * pinch-zoom from the browser too.
   *
   * Runs after the controls' own effect: child effects fire before the
   * parent's, and <OrbitControls> is a child of this component.
   */
  useEffect(() => {
    const element = controls.current?.domElement as HTMLElement | undefined;
    if (element) element.style.touchAction = "pan-y";
  }, []);

  // Reused across frames. Allocating a Vector3 per pin per frame is 420
  // allocations a second, which is exactly the shape of garbage that produces
  // a periodic hitch rather than a steady cost.
  const projected = useMemo(() => new Vector3(), []);

  useEffect(() => {
    // The park is in the scene graph and the next frame will paint it. Telling
    // the pin layer now rather than on load completion means the pins pop in
    // with the park rather than before it exists.
    onReady();
  }, [onReady]);

  useEffect(() => {
    // Abandon any flight still in progress when the scene unmounts.
    //
    // `flightStore` is module-level, so without this a flight outlives the
    // component that started it in two ways. It retains its `onArrive`
    // closure — and through it the router, the href and the enclosing
    // component scope — for the rest of the session, because only a frame can
    // clear it and no frames run once this is unmounted. And if the visitor
    // comes back to the park, the first frame finds an 800ms-stale flight,
    // completes it immediately and pushes that old route out from under them.
    return resetFlight;
  }, []);

  useFrame(() => {
    const flight = currentFlight();

    if (flight) {
      // On the demand loop nothing else will schedule the next frame of a
      // tween: the controls invalidate on their own input, but a flight is
      // driven from here. Ask for the frame after this one until it lands.
      invalidate();

      // A flight owns the camera while it runs. Two things driving one camera
      // produces a fight that reads as stutter.
      if (controls.current) controls.current.enabled = false;

      const elapsed = performance.now() - flight.startedAt;
      const orbit = orbitAt(flight.plan, elapsed);
      const [x, y, z] = cameraPosition(orbit);
      camera.position.set(x, y, z);
      camera.lookAt(TARGET_X, TARGET_Y, TARGET_Z);

      if (isComplete(flight.plan, elapsed)) {
        const arrive = completeFlight();
        if (controls.current) {
          controls.current.enabled = true;
          // The controls cache their own spherical coordinates, so they must be
          // told the camera moved or the next drag snaps back to where the
          // camera was before the flight.
          controls.current.update();
        }
        arrive?.();
      }
    }

    // Project every pin. Done after the camera has been moved, so the pins are
    // registered with the frame that is about to be drawn rather than with the
    // previous one — a one-frame lag here reads as the pins sliding across the
    // park during a tween.
    for (const attraction of PINNED_ATTRACTIONS) {
      const [px, py, pz] = attraction.position;
      projected.set(px, py, pz);
      projected.project(camera);

      // z > 1 after projection means the point is beyond the far plane or
      // behind the camera. Behind is the case that matters: the projection is
      // valid arithmetic and mirrors the pin to the opposite side of the
      // screen, which looks like a bug in the pin layer rather than in here.
      const behind = projected.z > 1;

      writePinPosition(attraction.id, {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        visible: !behind,
      });
    }
  });

  return (
    <>
      <primitive object={scene} />
      <OrbitControls
        ref={controls}
        target={ORBIT.target}
        enablePan={ORBIT.enablePan}
        enableDamping
        dampingFactor={ORBIT.dampingFactor}
        minPolarAngle={ORBIT.minPolarAngle}
        maxPolarAngle={ORBIT.maxPolarAngle}
        minDistance={ORBIT.minDistance}
        maxDistance={ORBIT.maxDistance}
        // Pan is off, so the two-finger gesture resolves to zoom alone.
        touches={TOUCHES}
      />
    </>
  );
}
