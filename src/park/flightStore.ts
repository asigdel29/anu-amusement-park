/**
 * flightStore.ts — the seam between a pin activation and the render loop.
 *
 * Contract: `startFlight` records a camera move for the render loop to pick up
 * on its next frame; `currentFlight` reads it; `completeFlight` clears it and
 * hands back the arrival callback exactly once.
 *
 * Requires of callers: only the render loop calls `completeFlight`, and it
 * calls it once per flight. The one-shot behaviour is enforced here rather than
 * trusted, because a callback that fired twice would push the same route twice
 * and put a duplicate entry in the visitor's history.
 *
 * Why a module-level store rather than a ref passed as a prop — which is what
 * this was first written as: the writer is a React event handler and the reader
 * is a `useFrame` callback, and a new flight must be picked up without
 * re-rendering the canvas. Re-rendering mid-tween drops a frame at the exact
 * moment it is most visible.
 *
 * Passing a mutable ref down as a prop expressed the same thing but made the
 * render loop mutate its own argument, which React's immutability rule
 * correctly rejects: a function that reassigns a prop after render is a
 * function whose behaviour depends on when it happens to run. A store makes
 * the mutation explicit and puts it behind named operations. It is also the
 * same shape as `pinStore`, for the same reason.
 */

import type { FlightPlan } from "./flyTo";

interface Flight {
  readonly plan: FlightPlan;
  readonly startedAt: number;
  readonly onArrive: () => void;
}

let flight: Flight | null = null;

/**
 * Records a camera move. Replaces any flight already in progress, without
 * calling its arrival callback.
 *
 * Replacing rather than queueing: a visitor who activates a second pin
 * mid-tween has changed their mind, and flying to the first attraction before
 * honouring the second would be obeying an instruction they withdrew.
 */
export function startFlight(plan: FlightPlan, onArrive: () => void): void {
  flight = { plan, startedAt: performance.now(), onArrive };
}

/** The flight in progress, or null. */
export function currentFlight(): Flight | null {
  return flight;
}

/**
 * Clears the flight and returns its arrival callback, or null if there was
 * none left to return.
 *
 * The callback is handed over rather than invoked here so the caller decides
 * when to run it, and it is cleared before being returned so a second call
 * gets null. That is what makes the route push happen exactly once.
 */
export function completeFlight(): (() => void) | null {
  if (!flight) return null;
  const { onArrive } = flight;
  flight = null;
  return onArrive;
}

/** Abandons any flight without calling its callback. Used by tests. */
export function resetFlight(): void {
  flight = null;
}
