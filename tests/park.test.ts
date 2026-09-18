/**
 * Contract tests for the park's arithmetic and its DOM seam.
 *
 * Everything under test here is pure or touches only a detached element, which
 * is why the camera bounds, the tween and the pin writes can be verified
 * without a WebGL context. The parts that genuinely need a GPU — that a click
 * on a projected pin reaches its route, that the no-WebGL path renders the
 * directory — are covered in `e2e/`.
 *
 * The bias in these tests is toward the cases that produce a *plausible* wrong
 * answer rather than an error, because those are the ones that ship: a camera
 * that dips under the island for three frames, a pin mirrored to the far side
 * of the screen, a tween that takes the long way round.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ORBIT,
  PARK_RADIUS,
  azimuthToward,
  clampDistance,
  clampPolar,
  fitDistance,
  orbitPosition,
} from "@/park/orbitRig";
import {
  cameraPosition,
  easeInOutCubic,
  flightPlan,
  isComplete,
  orbitAt,
  shortestTurn,
} from "@/park/flyTo";
import {
  registerPinElement,
  resetPinRegistry,
  writePinPosition,
} from "@/park/pinStore";
import {
  completeFlight,
  currentFlight,
  resetFlight,
  startFlight,
} from "@/park/flightStore";
import { ORBIT_TARGET, PINNED_ATTRACTIONS } from "@/content/attractions";

describe("orbit bounds", () => {
  it("keeps the camera above the horizon and off a straight-down view", () => {
    // The horizon is at pi/2. Past it the camera sees the water edge-on and
    // then from underneath, which is the state these bounds exist to prevent.
    expect(ORBIT.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(ORBIT.minPolarAngle).toBeGreaterThan(0);
  });

  it("clamps rather than wraps a polar angle past the bounds", () => {
    // Wrapping would let a hard drag past the horizon reappear underneath the
    // island — a plausible-looking result that is completely wrong.
    expect(clampPolar(Math.PI)).toBe(ORBIT.maxPolarAngle);
    expect(clampPolar(-Math.PI)).toBe(ORBIT.minPolarAngle);
    expect(clampPolar(0.8)).toBe(0.8);
  });

  it("clamps distance into the permitted range", () => {
    expect(clampDistance(0)).toBe(ORBIT.minDistance);
    expect(clampDistance(10_000)).toBe(ORBIT.maxDistance);
    expect(clampDistance(50)).toBe(50);
  });

  it("answers with a bound rather than NaN for a non-finite input", () => {
    // A NaN would propagate silently into the camera matrix and blank the
    // canvas, which is a far worse failure than a camera at its lower bound.
    expect(clampPolar(Number.NaN)).toBe(ORBIT.minPolarAngle);
    expect(clampDistance(Number.NaN)).toBe(ORBIT.minDistance);

    // An infinity is a direction, not an absence — "as far as allowed that
    // way" — so it clamps toward the bound it is heading for rather than
    // falling back to a default.
    expect(clampDistance(Number.POSITIVE_INFINITY)).toBe(ORBIT.maxDistance);
    expect(clampDistance(Number.NEGATIVE_INFINITY)).toBe(ORBIT.minDistance);
    expect(clampPolar(Number.POSITIVE_INFINITY)).toBe(ORBIT.maxPolarAngle);
    expect(clampPolar(Number.NEGATIVE_INFINITY)).toBe(ORBIT.minPolarAngle);
  });

  it("never returns a position below the island, at any input", () => {
    // The plate's surface is y=0 and the orbit target sits just above it, so
    // any camera with y <= 0 is inside or under the park.
    for (let azimuth = -8; azimuth <= 8; azimuth += 0.25) {
      for (let polar = -2; polar <= 5; polar += 0.1) {
        for (const distance of [-50, 0, 30, 90, 5000]) {
          const [, y] = orbitPosition(azimuth, polar, distance);
          expect(y, `polar=${polar} distance=${distance}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("stays outside the ferris wheel at the park's centre", () => {
    // The wheel is 8.5m in radius and 19m tall at the centre. A camera closer
    // than that clips it through the near plane.
    expect(ORBIT.minDistance).toBeGreaterThan(20);
  });
});

describe("azimuth toward an attraction", () => {
  it("faces the attraction's side of the park", () => {
    // +x should give a positive azimuth under the rig's sin/cos convention.
    expect(azimuthToward([10, 5, 0], 0)).toBeCloseTo(Math.PI / 2, 5);
    expect(azimuthToward([0, 5, 10], 0)).toBeCloseTo(0, 5);
  });

  it("holds the current angle for a point at the exact centre", () => {
    // atan2(0, 0) answers zero, which would swing the camera to due north for
    // no reason. There is no direction to face at the centre.
    expect(azimuthToward([...ORBIT_TARGET], 1.234)).toBe(1.234);
  });
});

describe("the fly-to tween", () => {
  const from = { azimuth: 0, polar: 0.95, distance: 68 };

  it("takes the short way round rather than the long way", () => {
    // A turn of 350 degrees is a turn of -10 degrees. Interpolating the raw
    // angle spins the park almost all the way round for a small correction.
    const turn = shortestTurn(0, (350 * Math.PI) / 180);
    expect(turn).toBeCloseTo((-10 * Math.PI) / 180, 5);
    expect(Math.abs(turn)).toBeLessThan(Math.PI);
  });

  it("is continuous and bounded at the ends of the easing curve", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    // A dropped frame can produce a progress value past 1; the endpoint is the
    // right answer, not an extrapolation beyond it.
    expect(easeInOutCubic(1.8)).toBe(1);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(Number.NaN)).toBe(1);
  });

  it("lands immediately when the duration is zero", () => {
    // This is the whole reduced-motion path: --duration-fly is zeroed, so the
    // camera cuts without a branch anywhere in the components.
    const plan = flightPlan(from, [20, 10, 4], 0);
    expect(orbitAt(plan, 0)).toEqual(plan.to);
    expect(isComplete(plan, 0)).toBe(true);
  });

  it("never leaves the permitted band mid-flight", () => {
    // A tween that overshoots and recovers reads as a glitch rather than as a
    // bound, so every intermediate frame is checked, not just the endpoints.
    for (const attraction of PINNED_ATTRACTIONS) {
      const plan = flightPlan(from, attraction.position, 800);
      for (let elapsed = 0; elapsed <= 800; elapsed += 16) {
        const orbit = orbitAt(plan, elapsed);
        const [, y] = cameraPosition(orbit);
        expect(y, `${attraction.id} at ${elapsed}ms`).toBeGreaterThan(0);
        expect(clampPolar(orbit.polar)).toBeCloseTo(orbit.polar, 6);
        expect(clampDistance(orbit.distance)).toBeCloseTo(orbit.distance, 6);
      }
    }
  });

  it("frames every attraction from the same height and distance", () => {
    // Arriving anywhere in the park should feel like arriving. Deriving the
    // pose from the structure would leave a visitor staring at the sky at the
    // launch tower and at the ground at the fortune booth.
    const poses = PINNED_ATTRACTIONS.map(
      (a) => flightPlan(from, a.position, 800).to,
    );
    const first = poses[0];
    for (const pose of poses) {
      expect(pose.polar).toBeCloseTo(first.polar, 10);
      expect(pose.distance).toBeCloseTo(first.distance, 10);
    }
    // ...but the azimuth must differ, or the camera is not turning to face
    // anything.
    expect(new Set(poses.map((p) => p.azimuth.toFixed(4))).size).toBeGreaterThan(1);
  });
});

describe("pin positions come from Blender", () => {
  it("has a distinct, finite position for every attraction", () => {
    expect(PINNED_ATTRACTIONS).toHaveLength(7);
    const seen = new Set<string>();
    for (const attraction of PINNED_ATTRACTIONS) {
      expect(attraction.position).toHaveLength(3);
      for (const component of attraction.position) {
        expect(Number.isFinite(component)).toBe(true);
      }
      seen.add(attraction.position.join(","));
    }
    // Two pins at one position means two stacked labels and one unreachable
    // attraction.
    expect(seen.size).toBe(PINNED_ATTRACTIONS.length);
  });

  it("puts no pin at the origin", () => {
    // The origin is where a pin lands when its Empty was renamed in Blender —
    // dead centre of the park, under the ferris wheel. It presents as a
    // styling bug and is actually a broken export.
    for (const attraction of PINNED_ATTRACTIONS) {
      const [x, , z] = attraction.position;
      expect(Math.hypot(x, z), attraction.id).toBeGreaterThan(1);
    }
  });

  it("hovers every pin above the plate", () => {
    for (const attraction of PINNED_ATTRACTIONS) {
      expect(attraction.position[1], attraction.id).toBeGreaterThan(0);
    }
  });
});

describe("the pin DOM seam", () => {
  beforeEach(() => resetPinRegistry());

  it("writes position, visibility and pointer state onto the element", () => {
    const node = document.createElement("a");
    registerPinElement("agent_arcade", node);

    writePinPosition("agent_arcade", { x: 120.5, y: 40, visible: true });
    // Rounded to whole pixels — see writePinPosition on why.
    expect(node.style.getPropertyValue("--translateX")).toBe("121px");
    expect(node.style.getPropertyValue("--translateY")).toBe("40px");
    expect(node.style.getPropertyValue("--visible")).toBe("1");
    expect(node.style.pointerEvents).toBe("auto");
  });

  it("makes a pin behind the camera invisible and unclickable", () => {
    // A point behind the camera projects to a mirrored position on the far side
    // of the screen. Leaving it clickable there means a visitor can activate an
    // attraction by clicking empty sky.
    const node = document.createElement("a");
    registerPinElement("the_factory", node);
    writePinPosition("the_factory", { x: -900, y: 20, visible: false });
    expect(node.style.getPropertyValue("--visible")).toBe("0");
    expect(node.style.pointerEvents).toBe("none");
  });

  it("does not rewrite a property already holding the value", () => {
    // The point of the cache: `visible` and `pointerEvents` change a handful of
    // times in a session and never in the default pose, but were being written
    // 60 times a second per pin. Counted through a style proxy rather than
    // asserted indirectly.
    const node = document.createElement("a");
    const writes: string[] = [];
    const real = node.style.setProperty.bind(node.style);
    node.style.setProperty = (name: string, value: string) => {
      writes.push(name);
      real(name, value);
    };
    registerPinElement("launch_tower", node);

    writePinPosition("launch_tower", { x: 10, y: 20, visible: true });
    expect(writes).toEqual(["--translateX", "--translateY", "--visible"]);

    writes.length = 0;
    writePinPosition("launch_tower", { x: 10, y: 20, visible: true });
    expect(writes).toEqual([]);

    writes.length = 0;
    writePinPosition("launch_tower", { x: 11, y: 20, visible: true });
    expect(writes).toEqual(["--translateX"]);
  });

  it("treats sub-pixel jitter as no change", () => {
    // A damping tail moves a pin by fractions of a pixel for many frames.
    // Without the rounding every one of those frames would write all four
    // properties, which is exactly when the cache most needs to hit.
    const node = document.createElement("a");
    registerPinElement("the_factory", node);
    writePinPosition("the_factory", { x: 100.1, y: 50.2, visible: true });
    const before = node.style.getPropertyValue("--translateX");
    writePinPosition("the_factory", { x: 100.4, y: 50.3, visible: true });
    expect(node.style.getPropertyValue("--translateX")).toBe(before);
    expect(before).toBe("100px");
  });

  it("ignores an unregistered pin instead of throwing", () => {
    // The render loop runs before the pin layer mounts. That frame having no
    // pins is the correct outcome, not an error.
    expect(() =>
      writePinPosition("not_mounted_yet", { x: 0, y: 0, visible: true }),
    ).not.toThrow();
  });

  it("forgets an element on unregister", () => {
    const node = document.createElement("a");
    registerPinElement("the_library", node);
    registerPinElement("the_library", null);
    writePinPosition("the_library", { x: 5, y: 5, visible: true });
    expect(node.style.getPropertyValue("--translateX")).toBe("");
  });
});

describe("the flight store", () => {
  const plan = flightPlan(
    { azimuth: 0, polar: 0.95, distance: 88 },
    [20, 10, 4],
    800,
  );

  beforeEach(() => resetFlight());

  it("holds a flight for the render loop to pick up", () => {
    expect(currentFlight()).toBeNull();
    startFlight(plan, () => {});
    expect(currentFlight()?.plan).toBe(plan);
  });

  it("hands the arrival callback over exactly once", () => {
    // Twice would push the same route twice and leave a duplicate entry in the
    // visitor's history. The render loop calls this from a frame callback, so
    // "once" cannot be left to the caller's discipline.
    let pushes = 0;
    startFlight(plan, () => {
      pushes += 1;
    });

    completeFlight()?.();
    completeFlight()?.();
    completeFlight()?.();

    expect(pushes).toBe(1);
    expect(currentFlight()).toBeNull();
  });

  it("drops a flight that is replaced mid-tween without routing", () => {
    // A visitor who activates a second pin has changed their mind. Honouring
    // the first destination first would be obeying an instruction they
    // withdrew.
    let first = 0;
    let second = 0;
    startFlight(plan, () => {
      first += 1;
    });
    startFlight(plan, () => {
      second += 1;
    });

    completeFlight()?.();

    expect(first).toBe(0);
    expect(second).toBe(1);
  });

  it("returns null when nothing is in flight", () => {
    expect(completeFlight()).toBeNull();
  });
});

describe("framing the park to a viewport", () => {
  const FOV = 40;

  it("needs far more distance on a portrait phone than on a desktop", () => {
    // The binding constraint is the horizontal field of view, which a vertical
    // fov only determines once the aspect is known. A constant tuned on a
    // desktop cropped the park to its centre on a phone, with no error.
    const phone = fitDistance(390 / 844, FOV);
    const desktop = fitDistance(1280 / 900, FOV);
    expect(phone).toBeGreaterThan(desktop * 2);
  });

  it("actually fits the park at the distance it returns", () => {
    // The property that matters, asserted directly rather than trusting the
    // algebra: at the returned distance, the park's bounding radius is inside
    // the horizontal half-width of the frustum.
    for (const aspect of [0.4, 0.46, 0.75, 1, 1.42, 2.2, 3]) {
      const distance = fitDistance(aspect, FOV);
      const halfHorizontal = Math.atan(
        aspect * Math.tan((FOV * Math.PI) / 360),
      );
      const halfWidth = distance * Math.tan(halfHorizontal);
      expect(halfWidth, `aspect ${aspect}`).toBeGreaterThanOrEqual(PARK_RADIUS);
    }
  });

  it("stays inside the orbit bounds at every aspect", () => {
    for (const aspect of [0.2, 0.46, 1, 1.42, 4, 10]) {
      const distance = fitDistance(aspect, FOV);
      expect(distance).toBeGreaterThanOrEqual(ORBIT.minDistance);
      expect(distance).toBeLessThanOrEqual(ORBIT.maxDistance);
    }
  });

  it("gives a usable framing for an unmeasured viewport", () => {
    // A zero or non-finite aspect comes from a viewport that has not been
    // measured yet. An infinite distance would blank the canvas for a frame.
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const distance = fitDistance(bad, FOV);
      expect(Number.isFinite(distance), `aspect ${bad}`).toBe(true);
      expect(distance).toBeGreaterThanOrEqual(ORBIT.minDistance);
    }
  });

  it("can orbit out far enough for the widest framing it produces", () => {
    // The maximum was raised for this reason: a portrait phone needs roughly
    // three times a desktop's distance, and a desktop-tuned maximum clamped
    // the phone's framing back into a crop.
    expect(ORBIT.maxDistance).toBeGreaterThanOrEqual(fitDistance(0.4, FOV));
  });
});
