/**
 * flyTo.ts — the camera tween's arithmetic, separated from its effects.
 *
 * Contract: `flightPlan` describes a move from the current orbit to the one
 * that frames a given attraction. `easeInOutCubic` and `shortestTurn` are pure
 * and total. Nothing here touches a camera, a clock, or the DOM — which is why
 * all of it can be tested without a WebGL context.
 *
 * Invariants:
 *   - A flight never leaves the permitted orbit band, because every position it
 *     produces goes through `orbitPosition`, which clamps. A tween that
 *     overshot mid-flight would dip the camera under the island for a few
 *     frames and then recover, which looks like a glitch rather than a bound.
 *   - The azimuth always takes the short way round. Interpolating raw angles
 *     sends the camera the long way whenever the turn crosses ±pi, which reads
 *     as the park spinning for no reason.
 *   - A zero-duration flight is valid and lands immediately. That is the
 *     reduced-motion path: `--duration-fly` is zeroed, so the camera cuts
 *     instead of moving, and no branch is needed anywhere else.
 */

import { ORBIT, azimuthToward, clampDistance, clampPolar, orbitPosition } from "./orbitRig";

/** One orbit state: where the camera is, expressed as the rig sees it. */
export interface Orbit {
  readonly azimuth: number;
  readonly polar: number;
  readonly distance: number;
}

/** A planned move between two orbit states. */
export interface FlightPlan {
  readonly from: Orbit;
  readonly to: Orbit;
  /** Milliseconds. Zero means land immediately. */
  readonly duration: number;
}

/**
 * The equivalent of `b` reached by turning the short way from `a`.
 *
 * Angles are unbounded, so the naive difference between two of them can exceed
 * half a turn — and interpolating across that sends the camera the long way
 * round. This returns a target angle that may lie outside [-pi, pi] but is
 * always within half a turn of `a`.
 */
export function shortestTurn(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  let delta = (b - a) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return a + delta;
}

/**
 * Cubic ease-in-out over [0, 1].
 *
 * Matches the feel of the reference's default curve closely enough for a
 * camera move, and unlike a CSS cubic-bezier it can be evaluated per frame
 * without a DOM. Clamped, so a caller that passes a progress value outside the
 * unit interval — which a dropped frame can produce — gets the endpoint rather
 * than an extrapolation past it.
 */
export function easeInOutCubic(t: number): number {
  if (!Number.isFinite(t)) return 1;
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Plans the move that frames `position`.
 *
 * The destination polar angle and distance are deliberately fixed rather than
 * derived from the attraction: every attraction is framed from the same height
 * and distance, so arriving anywhere in the park feels like arriving, and a
 * visitor is never left staring at the sky because one structure happened to be
 * tall. Only the azimuth depends on which attraction it is.
 */
export function flightPlan(
  from: Orbit,
  position: readonly [number, number, number],
  duration: number,
): FlightPlan {
  const targetAzimuth = shortestTurn(
    from.azimuth,
    azimuthToward(position, from.azimuth),
  );

  return {
    from,
    to: {
      azimuth: targetAzimuth,
      // Two thirds of the way down the permitted band: low enough to see the
      // structure's face rather than its roof, high enough to keep the rest of
      // the park in frame so the visitor does not lose their bearings.
      polar: clampPolar(
        ORBIT.minPolarAngle +
          (ORBIT.maxPolarAngle - ORBIT.minPolarAngle) * 0.66,
      ),
      distance: clampDistance(ORBIT.minDistance + 6),
    },
    duration: Math.max(0, duration),
  };
}

/**
 * The orbit state a plan is in at `elapsed` milliseconds.
 *
 * A zero-duration plan returns its destination for any elapsed time, which is
 * what makes the reduced-motion path fall out of the arithmetic rather than
 * needing a branch at the call site.
 */
export function orbitAt(plan: FlightPlan, elapsed: number): Orbit {
  if (plan.duration <= 0) return plan.to;

  const t = easeInOutCubic(elapsed / plan.duration);
  return {
    azimuth: plan.from.azimuth + (plan.to.azimuth - plan.from.azimuth) * t,
    polar: plan.from.polar + (plan.to.polar - plan.from.polar) * t,
    distance: plan.from.distance + (plan.to.distance - plan.from.distance) * t,
  };
}

/** True once a plan has run its course. */
export function isComplete(plan: FlightPlan, elapsed: number): boolean {
  return elapsed >= plan.duration;
}

/** The camera position for an orbit state, clamped into the permitted band. */
export function cameraPosition(orbit: Orbit): [number, number, number] {
  return orbitPosition(orbit.azimuth, orbit.polar, orbit.distance);
}
