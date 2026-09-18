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
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PINNED_ATTRACTIONS } from "@/content/attractions";
import { ORBIT } from "./orbitRig";
import { useParkScene } from "./useGLTFUnlit";
import { writePinPosition } from "./pinStore";
import { cameraPosition, isComplete, orbitAt } from "./flyTo";
import { completeFlight, currentFlight } from "./flightStore";

export function ParkScene({ onReady }: { onReady: () => void }) {
  const scene = useParkScene();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera, size } = useThree();

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

  useFrame(() => {
    const flight = currentFlight();

    if (flight) {
      // A flight owns the camera while it runs. Two things driving one camera
      // produces a fight that reads as stutter.
      if (controls.current) controls.current.enabled = false;

      const elapsed = performance.now() - flight.startedAt;
      const orbit = orbitAt(flight.plan, elapsed);
      const [x, y, z] = cameraPosition(orbit);
      camera.position.set(x, y, z);
      camera.lookAt(...ORBIT.target);

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
      projected.set(...attraction.position);
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
        // One-finger orbit, two-finger pan-and-zoom is the gesture set a
        // visitor already knows from every map application. Pan is off, so the
        // two-finger gesture resolves to zoom alone.
        touches={{ ONE: 1, TWO: 2 }}
      />
    </>
  );
}
