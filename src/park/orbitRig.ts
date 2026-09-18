/**
 * orbitRig.ts — the camera constraints, and the arithmetic behind them.
 *
 * Contract: `ORBIT` is the single declaration of where a visitor is allowed to
 * look at the park from. `clampPolar` and `clampDistance` are the pure
 * functions that enforce it, exported separately so they can be tested without
 * a WebGL context.
 *
 * The camera is constrained at all times. A visitor can turn the park and lean
 * in; they cannot fly out of it, look at its underside, or push the near plane
 * through the ferris wheel. An unconstrained orbit camera on a map like this
 * reliably ends up below the water plane looking up at nothing, and a visitor
 * who gets there has no way of knowing what went wrong.
 *
 * Numbers come from the scene the build script produces: the island is 60m
 * across (PLATE_RADIUS 30) and its tallest structure, the launch tower, reaches
 * about 19m.
 */

import { ORBIT_TARGET } from "@/content/attractions";

export const ORBIT = {
  /**
   * How far down the camera may tilt, in radians from straight up.
   *
   * The upper bound stops just short of the horizon. Past it the camera sees
   * the water plane edge-on and then from underneath, and the island reads as
   * a floating slab rather than a place. The lower bound keeps it off a
   * straight-down view, which flattens the park into a floorplan and hides
   * every vertical sign the structures are identified by.
   */
  minPolarAngle: 0.35,
  maxPolarAngle: 1.29, // ~74 degrees; the horizon is at pi/2

  /**
   * Orbit distance bounds, in metres.
   *
   * The minimum keeps the camera outside the ferris wheel at the park's centre,
   * which is 8.5m in radius and 19m tall — closer than this and the wheel
   * clips through the near plane. The maximum is where the island stops filling
   * the frame and starts being a small object in a large void.
   */
  minDistance: 26,
  maxDistance: 96,

  /** Where the orbit pivots. Slightly above the plate, so the park sits in the
   * lower two thirds of frame rather than dead centre — the reference's
   * composition, and it leaves room for the pin labels above the skyline. */
  target: ORBIT_TARGET,

  /** Matches the reference's damped feel. Below about 0.05 the camera drifts
   * after the pointer stops, which reads as lag rather than as weight. */
  dampingFactor: 0.08,

  /** Panning is disabled: it is how a visitor loses the park entirely. Orbit
   * and zoom together already reach every viewpoint worth having, and the
   * target is fixed so the park can never leave the frame. */
  enablePan: false,
} as const;

/**
 * Constrains a polar angle to the permitted band.
 *
 * Clamped rather than wrapped. Wrapping would let a visitor who drags hard
 * past the horizon reappear underneath the island, which is exactly the state
 * these bounds exist to prevent.
 */
export function clampPolar(angle: number): number {
  // Only NaN gets a default. An infinity is a direction, not an absence: it
  // means "as far as allowed that way", and Math.min/max already answer that
  // correctly. Treating it as undetermined instead — which an
  // `!Number.isFinite` guard does — sent a camera told to look infinitely far
  // down to the top of its band, the opposite of what it was asked.
  if (Number.isNaN(angle)) return ORBIT.minPolarAngle;
  return Math.min(ORBIT.maxPolarAngle, Math.max(ORBIT.minPolarAngle, angle));
}

/** Constrains an orbit distance to the permitted range. See `clampPolar` on
 * why only NaN is treated as undetermined. */
export function clampDistance(distance: number): number {
  if (Number.isNaN(distance)) return ORBIT.minDistance;
  return Math.min(ORBIT.maxDistance, Math.max(ORBIT.minDistance, distance));
}

/**
 * The camera position for a given orbit, in the runtime's Y-up coordinates.
 *
 * Both inputs are clamped on the way in, so this cannot return a position
 * outside the permitted band however it is called. That matters because the
 * fly-to tween computes intermediate positions with it, and a tween that
 * overshoots its bounds mid-flight would dip the camera under the island for a
 * few frames.
 */
export function orbitPosition(
  azimuth: number,
  polar: number,
  distance: number,
): [number, number, number] {
  const p = clampPolar(polar);
  const d = clampDistance(distance);
  const [tx, ty, tz] = ORBIT.target;
  return [
    tx + d * Math.sin(p) * Math.sin(azimuth),
    ty + d * Math.cos(p),
    tz + d * Math.sin(p) * Math.cos(azimuth),
  ];
}

/**
 * The azimuth that puts a world position between the camera and the park's
 * centre — the angle to fly to when an attraction is activated.
 *
 * Returns the current azimuth unchanged for a point at the exact centre, since
 * there is no direction to face there and `atan2(0, 0)` would silently answer
 * zero, swinging the camera to due north for no reason.
 */
export function azimuthToward(
  position: readonly [number, number, number],
  currentAzimuth: number,
): number {
  const [x, , z] = position;
  const dx = x - ORBIT.target[0];
  const dz = z - ORBIT.target[2];
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return currentAzimuth;
  return Math.atan2(dx, dz);
}
