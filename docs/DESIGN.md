# Design

The site is an amusement park. The park is the navigation layer, not the whole
experience: it exists to get a visitor to a page, and each page is a plain,
readable document.

Working concept: **debugging reality**. Subtitle: **rides may break in
production**. Nighttime carnival — neon rides, strange machines, agent mascots
and unfinished construction zones. Coney Island by way of an AI lab.

## The navigation reference

<https://madbox.io/> — and the frame of it captured in
[`reference/madbox-map.png`](reference/madbox-map.png).

This is an **interaction and spatial-navigation reference, not a visual target**.
What is being copied is how a visitor moves through a 3D world map and gets from
it to content. What is not being copied is the daylight pastel look: their map is
an afternoon, this park is at night.

### What the reference actually does

Recovered by reading their shipped bundles and stylesheet, so this is a
description of a working implementation rather than an impression of a
screenshot:

- **Vanilla three.js with damped `OrbitControls`**, clamped by `maxPolarAngle`
  and a `minDistance`/`maxDistance` pair. The camera is constrained. A visitor
  can turn the world and lean in; they cannot fly out of it or look at its
  underside.
- **Everything is baked and unlit.** Their bundle carries ~80 `lightMap`
  references, `MeshBasicMaterial`, and roughly twenty `baked<Zone>.basis`
  textures. There are no runtime lights and no shadow pass. This is the single
  most important decision in the whole reference: it is why a scene this dense
  holds its framerate on a phone, and this park copies it exactly. See
  [ASSETS.md](ASSETS.md).
- **Geometry is split per prop** across 57 Draco-compressed `.glb` files. The
  entire island set is one 1.12 MB file; their pin geometry is 9 KB.
- **`InstancedMesh`, `LOD` and explicit `frustumCulled`** for anything repeated.
- **A `Raycaster` on `pointerdown` and `touchstart`** picks the hotspots.
  Activating one tweens the camera toward it before the content appears.
- **A world-curvature vertex shader** bends the horizon, which is what makes a
  flat plate of geometry read as a small planet.
- **`setPixelRatio` is clamped** against `devicePixelRatio`, with a separate
  mobile branch.

### The pin layer

Their pins are **DOM elements, not 3D objects**, and that is worth copying
almost literally. One absolutely-positioned element per hotspot, moved each
frame by:

```css
transform: translate(-50%, -50%) translate3d(var(--translateX), var(--translateY), 0);
```

from the hotspot's projected world position. A single `--visible: 0 | 1` custom
property drives both `opacity` and `scale`, so revealing a pin is one property
write. The layer is `pointer-events: none` until the scene has loaded, then
takes an `-active` class.

Keeping the pins in the DOM means their labels are real text: selectable,
translatable, addressable by a screen reader, focusable by a keyboard, and
styled from the same tokens as the content pages. A `Sprite`-based pin would
have been none of those things.

Their hero also carries a day/night state. This park takes the night and keeps
it.

### The interaction contract

1. An idle pin is a small hollow ring.
2. Hover — or keyboard focus — expands it into a labelled pill.
3. Activating it tweens the camera to the attraction, then routes to its page.
4. Under `prefers-reduced-motion` the tween does not happen; the camera cuts.

## The design system

Tokens are measured from the reference's stylesheet and declared once, in
[`../src/design/tokens.css`](../src/design/tokens.css). That file is the only
place a colour, size, radius, easing curve or breakpoint is defined. A literal
anywhere else is a defect.

### Type

Display **Changa** at weight 800 — heavy and geometric, which is what carnival
signage is. Body **Work Sans**. Both are self-hosted at build time by
`next/font`, so nothing is fetched from a font CDN at runtime and the CSP needs
no third-party exception.

Display scale, five steps: `1.875 / 3.75 / 4.375 / 6.25 / 8.75rem`.
Body: `0.875 / 1 / 1.125rem`. Tracking `-0.03em` on display, `-0.01em` on body.

### Colour

The neon set is taken from the reference unchanged, because neon on black is
what it was already good at:

| Token | Value | Contrast on panel |
| --- | --- | --- |
| `--neon-mint` | `#4ff29f` | 13.05:1 |
| `--neon-yellow` | `#ffbf04` | 11.41:1 |
| `--neon-cyan` | `#00c2ff` | 9.12:1 |
| `--neon-blue` | `#38b7ff` | 8.43:1 |
| `--neon-pink` | `#ff3891` | 5.59:1 |
| `--neon-purple` | `#ad00ff` | **3.79:1 — large text only** |

The surfaces are this site's own: ground `#08070d`, panel `#121019`, hairline
`#241f33`, text `#f4f1ea`, muted `#9a94ad`.

**`--neon-purple` is the only accent that fails WCAG AA for body text.** It is
admissible for display type, park signage and pin fills, and nowhere else. This
is not a guideline: `tests/tokens.test.ts` asserts it in both directions, so the
restriction cannot become stale and an accent cannot quietly become unsafe.
`npm run contrast` prints the whole table.

Each attraction owns exactly one accent, declared beside its route in
`src/content/attractions.ts`. That one declaration drives its pin, its page's
heading rule, and its emissive signage in Blender — so the park and the page
cannot disagree about what colour an attraction is.

### Geometry and motion

Pills are fully round (`5.9375rem`), panels `1.25rem`, chips `0.9375rem`. A
pin's hit area is never smaller than 44px, which is both the reference's touch
size and the WCAG target-size floor.

Four easing curves, all from the reference:

| Purpose | Curve |
| --- | --- |
| Default | `cubic-bezier(.215, .61, .355, 1)` |
| Opacity | `cubic-bezier(.19, 1, .22, 1)` |
| Pin pop-in, overshooting | `cubic-bezier(.175, .885, .32, 1.275)` |
| Exits | `cubic-bezier(.55, .055, .675, .19)` |

Pin pop-in is 600ms of transform and 400ms of opacity, staggered 100ms apart.
The camera fly-to is 800ms. Every duration is a token, and the reduced-motion
block zeroes all of them — so a component that references the tokens honours the
preference without branching, and one that hard-codes a duration is caught by
`tests/tokens.test.ts`.

### Layout

12 columns. Gutter 40px on desktop, 0 on mobile. Page margin 80px desktop, 16px
mobile. Content is capped by measure, not by viewport. Breakpoints
`480 / 768 / 960 / 1024 / 1440 / 1920`.

Hover affordances live behind `@media (any-hover: hover)`. A touch device never
inherits a hover-only path, which is what keeps the pins usable on a phone.

## Accessibility is the substrate, not the fallback

`src/design/ParkDirectory.tsx` renders every attraction as a plain server-side
list of links, and it ships on the same page as the park rather than behind a
capability check. The park draws over it.

This means the site is fully navigable by a screen reader, by a keyboard, by a
crawler, and in a browser with WebGL unavailable or JavaScript switched off —
and because that path is always rendered, it cannot rot while the 3D layer is
the interesting part. `e2e/navigation.spec.ts` verifies all three routes in,
including with `javaScriptEnabled: false`.

## Budgets

Committed numbers, enforced by `npm run size` and `npm run test:perf`. They are
derived from what the reference site itself ships.

| Metric | Budget | Now |
| --- | --- | --- |
| Baked park payload (geometry + embedded atlas) | ≤ 1.5 MB | 350 KB |
| Client JavaScript, gzipped | ≤ 600 KB | 173 KB |
| Content route LCP, throttled mid-tier mobile | ≤ 1.5 s | — |
| Park first-interactive, same profile | ≤ 3.5 s | — |
| Steady-state frame time, mid-tier mobile | ≤ 16.7 ms p95 | — |

Changing a budget means changing it in this table and in
`scripts/checkBundleSize.mjs` together, with the measurement that justifies it.

## Decisions taken, and what they rule out

- **Orbit and pins, not an avatar.** The reference is a map you turn and click.
  This rules out a player controller, collision, step-up, chunk streaming and a
  touch joystick — all of which exist in `anu-minecraft-world` and none of which
  an orbit map needs.
- **Attractions are routes, not modals.** A modal over a canvas cannot be
  server-rendered, linked to, or read without JavaScript. Every attraction is a
  real page.
- **Content is static.** No API routes, no environment variables, no key-value
  store. The previous generation of this site carried live Spotify, GitHub and
  Substack integrations; each was an operational tax on a portfolio, and none is
  reintroduced here.
- **Unfinished attractions are visible and say so.** The reference's map shows
  every island. An attraction without content gets a page that admits it.
  Hiding the pin would make the park smaller than the map; inventing content
  would be worse.
