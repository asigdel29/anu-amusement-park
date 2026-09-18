/**
 * pinStore.ts — the seam between the render loop and the pin layer.
 *
 * Contract: the pin layer registers its DOM elements here; the render loop
 * calls `writePinPosition` for each pin, each frame, and the position lands on
 * the element. Nothing here re-renders React.
 *
 * Requires of callers: `registerPinElement(id, node)` on mount and
 * `registerPinElement(id, null)` on unmount. An unregistered id is a silent
 * no-op, which is deliberate — the render loop starts before the pin layer has
 * mounted, and one frame of missing pins is correct rather than an error.
 *
 * Why a module-level registry rather than React state or context: the writer
 * lives inside the R3F tree and the reader outside it, so they share no
 * provider, and the values change sixty times a second. Routing seven pairs of
 * numbers through state would have React re-render seven components per frame
 * to decide that nothing about them had changed — more work to decide than to
 * do. This writes two custom properties per pin and returns.
 *
 * Positions are written as custom properties rather than to `style.transform`,
 * so the transform itself stays in the stylesheet where the design system can
 * see it. This is the reference's own arrangement.
 */

/** Screen-space position of one pin. */
export interface ProjectedPin {
  /** Pixels from the container's left edge. */
  readonly x: number;
  /** Pixels from the container's top edge. */
  readonly y: number;
  /**
   * False when the pin is behind the camera.
   *
   * Distinct from being off-screen. An off-screen pin is clipped by the
   * viewport, which is correct. A pin behind the camera projects to a
   * plausible-looking but mirrored position on the opposite side of the
   * screen — so it is hidden and made unclickable instead.
   */
  readonly visible: boolean;
}

/**
 * A registered pin, with the last values written to it.
 *
 * The cache is in the same record as the node so one Map lookup per frame
 * gets both. Its purpose is to skip writes that would set a property to the
 * value it already holds: `visible` changes a handful of times in a whole
 * session and never at all in the default pose, yet it and `pointerEvents`
 * were being written 60 times a second per pin regardless.
 */
interface Registered {
  readonly node: HTMLElement;
  x: number;
  y: number;
  visible: boolean | null;
}

const elements = new Map<string, Registered>();

/** Registers, or with `null` unregisters, a pin's element. */
export function registerPinElement(id: string, node: HTMLElement | null): void {
  if (node) {
    // NaN and null seed the cache so the first write of each property always
    // lands, whatever the projection happens to produce.
    elements.set(id, { node, x: Number.NaN, y: Number.NaN, visible: null });
  } else {
    elements.delete(id);
  }
}

/**
 * Writes a projected position onto a registered pin, skipping any property
 * already holding the value.
 *
 * Coordinates are rounded to whole pixels. That shortens every string the CSS
 * value parser has to chew through, and — more importantly — it is what makes
 * the change check actually hit during a damping tail, where sub-pixel jitter
 * would defeat an exact comparison and write all four properties every frame
 * anyway. At a device pixel ratio of 1.5 or more the rounding is invisible.
 *
 * A no-op for an unregistered id: the render loop may run a frame before the
 * pin layer mounts, and that frame having no pins is the correct outcome.
 */
export function writePinPosition(id: string, pin: ProjectedPin): void {
  const entry = elements.get(id);
  if (!entry) return;

  const x = Math.round(pin.x);
  const y = Math.round(pin.y);
  const style = entry.node.style;

  if (x !== entry.x) {
    style.setProperty("--translateX", `${x}px`);
    entry.x = x;
  }
  if (y !== entry.y) {
    style.setProperty("--translateY", `${y}px`);
    entry.y = y;
  }
  if (pin.visible !== entry.visible) {
    style.setProperty("--visible", pin.visible ? "1" : "0");
    // A pin behind the camera must not be clickable at whatever position it
    // projected to.
    style.pointerEvents = pin.visible ? "auto" : "none";
    entry.visible = pin.visible;
  }
}

/** Clears the registry. Exists for tests; nothing in the app calls it. */
export function resetPinRegistry(): void {
  elements.clear();
}
