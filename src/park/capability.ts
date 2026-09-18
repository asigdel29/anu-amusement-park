/**
 * capability.ts — what this browser can actually do, asked once and answered
 * honestly.
 *
 * Contract: every function here is safe to call during render on the server as
 * well as the client. Each returns the conservative answer when it cannot tell,
 * because the conservative answer is always the one that still works: no WebGL
 * means the directory underneath the park is the whole site, and that path is
 * fully functional.
 *
 * Requires of callers: treat these as one-time decisions, not per-frame
 * queries. `supportsWebGL` allocates a context to find out, which is not free.
 *
 * Why feature detection and never a user-agent string: a user-agent test is
 * wrong about every device it has not already met, and the set of devices it has
 * not met only grows. `(pointer: coarse)` asks the question that actually
 * matters — is this a finger — and it is right about hardware nobody has
 * shipped yet.
 */

/**
 * True when a WebGL2 context can actually be created.
 *
 * Not "does the browser claim to support WebGL": a context can fail to
 * allocate because the GPU is blocklisted, because too many contexts are
 * already live, or because the machine is out of video memory. The only
 * trustworthy answer comes from trying.
 *
 * The probe canvas is discarded immediately and its context explicitly lost, so
 * this does not consume one of the browser's limited context slots.
 */
export function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    // Hand the context back rather than waiting for garbage collection.
    // Browsers cap live contexts at around sixteen, and the park needs one.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the primary pointer is a finger rather than a mouse.
 *
 * Module-private: only `pixelRatioRange` needs it. Component code asks about
 * touch through CSS `@media (any-hover: hover)` / `(hover: none)`, which is
 * where that question belongs.
 */
function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/*
 * There is deliberately no `prefersReducedMotion()` here.
 *
 * Reduced motion is honoured by reading the `--duration-fly` token, which
 * tokens.css zeroes inside the media query — so every duration has one
 * declaration and no component needs a branch. A predicate here would be the
 * obvious thing to reach for and would reintroduce exactly the drift that
 * arrangement exists to prevent. See src/design/tokens.css invariant 3.
 */

/**
 * The device pixel ratio the park should render at, as three.js's `[min, max]`
 * pair.
 *
 * Clamping this is the single cheapest way to keep the frame budget on a phone:
 * a modern handset reports a ratio of 3, which is nine times the fragment work
 * of rendering at 1. The park is flat-shaded, baked, and viewed from a
 * distance, so the third pixel of precision buys nothing a visitor can see
 * while costing two thirds of the fill rate.
 *
 * Touch devices are clamped harder than desktops for the same reason the
 * reference site branches on it: their pixel ratios are higher and their fill
 * rates are lower, which is the worst possible combination.
 */
export function pixelRatioRange(): [number, number] {
  return isCoarsePointer() ? [1, 1.5] : [1, 2];
}
