/**
 * modelUrl.ts — where the baked park is served from.
 *
 * Its own module because two very different places need it and neither should
 * import the other: `useGLTFUnlit` loads it inside the client-only park chunk,
 * and `app/page.tsx` preloads it from a Server Component. Importing the loader
 * from the page would pull three.js into the server bundle to read a string.
 */

/** Path of the baked park, relative to the site root. */
export const PARK_MODEL_URL = "/models/park/Park.glb";
