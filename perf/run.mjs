/**
 * run.mjs — the latency harness.
 *
 * Contract: measures this site against the budgets in docs/DESIGN.md on a
 * throttled mid-tier-mobile profile, prints a table, and exits non-zero if any
 * budget is exceeded. The budgets are assertions, not report lines: a run that
 * prints a number over budget and exits zero is not a gate.
 *
 * Usage:
 *     npm run build && npm run test:perf
 *     PERF_BASE_URL=https://park.anubhavsigdel.com npm run test:perf
 *
 * Against a local build by default, and against a deployment when given a base
 * URL — which is how the cutover gate runs it, since a local build does not
 * measure the CDN, the compression or the cache headers.
 *
 * What is measured, and why each one:
 *
 *   LCP     The largest paint on each content route. The content is the site
 *           as far as a reader is concerned, so this is the number that says
 *           whether the writing arrives quickly.
 *   CLS     Layout shift. The park mounts over already-painted content, which
 *           is exactly the arrangement that causes shift if it is done wrong.
 *   Park    Time until the pin layer becomes active — the park's real
 *           first-interactive, since that is when a visitor can use it.
 *   Frame   Frame time at p95 during a scripted orbit, plus the share of
 *           frames that missed the 60Hz deadline. Reported at p95 and not as a
 *           mean, because a mean hides precisely the stutter a visitor
 *           notices.
 *
 * Chromium only: the throttling comes from CDP, which the other engines do not
 * implement. Measuring one engine honestly is better than reporting numbers
 * from three that are not comparable.
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3100";

/**
 * A mid-tier phone on a good mobile connection.
 *
 * 4x CPU throttling is the Lighthouse mobile default and approximates a
 * mid-range Android against a development machine. The network figures are
 * Lighthouse's "Slow 4G". Both are stated here rather than left implicit,
 * because a latency budget without the profile it was measured on is a number
 * with no meaning.
 */
const PROFILE = {
  cpuThrottling: 4,
  network: {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  },
};

/** Every budget, in milliseconds unless stated. */
const BUDGETS = {
  contentLcp: 1500,

  /*
   * 6500ms, revised up from a pre-measurement 3500ms.
   *
   * The park's cost is transfer, not work, and the transfer is close to
   * irreducible. At this profile's 200 KB/s the payload is:
   *
   *     three.js                256 KB gz   ~1.3s
   *     R3F + drei               70 KB gz   ~0.4s
   *     Next + React             85 KB gz   ~0.4s
   *     Park.glb                363 KB      ~1.8s
   *     Draco decoder           251 KB      ~1.3s
   *     fonts                    ~40 KB     ~0.2s
   *                                         ------
   *                                          ~5.4s
   *
   * Measured: 5.77s, within half a second of that floor. 3500ms was not a
   * budget this site could meet in any form that still had a 3D park in it —
   * three.js alone is a quarter of the payload and is the 3D engine.
   *
   * Three things were tried against it rather than revising it on sight:
   *
   *   Preloading the model in parallel with its JavaScript, which was a real
   *   fault and is fixed: 6.37s -> 5.77s.
   *
   *   Dropping Draco to save the 251 KB decoder. Measured and rejected: the
   *   geometry goes from 372 KB to 1,173 KB without it, so Draco is 550 KB
   *   ahead including its decoder.
   *
   *   Halving the atlas to 1024, worth about 0.6s. Measured and rejected: the
   *   ferris wheel's spokes thicken into black bars and the midway gains
   *   seams. See ATLAS_SIZE in assets/pipeline/bake_export.py.
   *
   * 6500ms leaves headroom for variance while still failing a regression. The
   * number that matters for a reader is the content LCP, which is ~0.55s
   * against a 1.5s budget — the park is an optional layer over a site that is
   * already fast, which is what the substrate design was for.
   */
  parkInteractive: 6500,

  /*
   * 20ms, not 16.7ms.
   *
   * The original budget was unmeetable by definition. requestAnimationFrame is
   * capped at the display's refresh rate, so a *perfectly* smooth run on a
   * 60Hz display reports intervals of exactly 16.7ms — the first measured run
   * came in at 16.7ms against a 16.7ms budget and failed. The budget was
   * describing the cap rather than the park's headroom.
   *
   * 20ms allows the normal jitter around a 60Hz cap while still failing a
   * sustained drop below about 50fps, which is the point at which an orbit
   * stops feeling attached to the pointer.
   */
  frameP95: 20,

  /*
   * The honest measure of smoothness on a capped display: what share of frames
   * took longer than two refresh intervals, i.e. dropped one. A p95 near the
   * cap says nothing about whether the remaining 5% were catastrophic.
   */
  droppedFrameRatio: 0.05,

  cls: 0.1,
};

/** Two 60Hz refresh intervals. A frame longer than this dropped one. */
const DROPPED_FRAME_MS = 33.4;

const CONTENT_ROUTES = [
  "/arcade",
  "/factory",
  "/library",
  "/launch",
  "/fortune",
  "/graveyard",
  "/workshop",
  "/about",
];

/**
 * Installed before any page script so the observers are registered before the
 * paints they are meant to observe. Registering them after load would miss LCP
 * entirely on a fast route and report zero, which reads as a perfect score.
 */
const OBSERVER = () => {
  const store = { lcp: 0, cls: 0 };
  // @ts-expect-error -- deliberately on window for the harness to read back.
  window.__perf = store;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      store.lcp = Math.max(store.lcp, entry.startTime);
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Shifts the visitor caused by interacting are not the site's fault.
      if (!entry.hadRecentInput) store.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", {
    rate: PROFILE.cpuThrottling,
  });
  await cdp.send("Network.emulateNetworkConditions", PROFILE.network);
  return cdp;
}

/** LCP and CLS for one route. */
async function measureRoute(browser, route) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.addInitScript(OBSERVER);
  await throttle(page);

  await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  // LCP is only final once the page has settled; a candidate can be replaced
  // by a later, larger paint.
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => window.__perf);
  await context.close();
  return metrics;
}

/**
 * Park first-interactive and frame time under a scripted orbit.
 *
 * The orbit is scripted rather than idle because an idle WebGL scene with
 * nothing moving is the cheapest frame it will ever draw. Measuring that would
 * report a frame budget the park never actually has to meet.
 */
async function measurePark(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.addInitScript(OBSERVER);
  await throttle(page);

  const started = Date.now();
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });

  // The park is interactive when its pin layer goes active — that is the
  // moment a visitor can actually use it, rather than the moment a script
  // finished downloading.
  let interactive = Number.POSITIVE_INFINITY;
  try {
    await page.waitForSelector('[class*="Pins-module"][class*="active"]', {
      timeout: 25_000,
    });
    interactive = Date.now() - started;
  } catch {
    // Left as Infinity so it fails the budget loudly rather than being absent
    // from the table.
  }

  // Sample frame times across a drag. Collected in the page and read back
  // once, so the measurement is not paying for a round trip per frame.
  await page.evaluate(() => {
    const samples = [];
    let last = performance.now();
    let raf = 0;
    const tick = (now) => {
      samples.push(now - last);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // @ts-expect-error -- harness handle
    window.__frames = {
      samples,
      stop: () => cancelAnimationFrame(raf),
    };
  });

  await page.mouse.move(195, 400);
  await page.mouse.down();
  for (let step = 0; step < 40; step += 1) {
    await page.mouse.move(195 + step * 4, 400 + Math.sin(step / 6) * 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);

  const frames = await page.evaluate(() => {
    window.__frames.stop();
    // The first two samples include the observer's own setup.
    return window.__frames.samples.slice(2);
  });

  const metrics = await page.evaluate(() => window.__perf);
  await context.close();

  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    : Number.POSITIVE_INFINITY;
  const dropped = frames.filter((f) => f > DROPPED_FRAME_MS).length;
  const droppedRatio = frames.length ? dropped / frames.length : 1;

  return {
    interactive,
    p95,
    droppedRatio,
    frameCount: frames.length,
    cls: metrics.cls,
  };
}

const ms = (n) => (Number.isFinite(n) ? `${Math.round(n)} ms` : "not reached");

async function main() {
  const browser = await chromium.launch();
  const rows = [];
  const failures = [];

  console.log(
    `Profile: ${PROFILE.cpuThrottling}x CPU, ` +
      `${Math.round((PROFILE.network.downloadThroughput * 8) / 1024 / 1024 * 10) / 10} Mbps down, ` +
      `${PROFILE.network.latency}ms RTT, 390x844\nTarget: ${BASE_URL}\n`,
  );

  for (const route of CONTENT_ROUTES) {
    const { lcp, cls } = await measureRoute(browser, route);
    const overLcp = lcp > BUDGETS.contentLcp;
    const overCls = cls > BUDGETS.cls;
    if (overLcp) failures.push(`${route} LCP ${ms(lcp)} > ${ms(BUDGETS.contentLcp)}`);
    if (overCls) failures.push(`${route} CLS ${cls.toFixed(3)} > ${BUDGETS.cls}`);
    rows.push({
      measure: `LCP ${route}`,
      value: ms(lcp),
      budget: ms(BUDGETS.contentLcp),
      status: overLcp ? "OVER" : "ok",
    });
    rows.push({
      measure: `CLS ${route}`,
      value: cls.toFixed(3),
      budget: BUDGETS.cls.toFixed(3),
      status: overCls ? "OVER" : "ok",
    });
  }

  const park = await measurePark(browser);
  const overInteractive = !(park.interactive <= BUDGETS.parkInteractive);
  const overFrame = !(park.p95 <= BUDGETS.frameP95);
  if (overInteractive) {
    failures.push(
      `park first-interactive ${ms(park.interactive)} > ${ms(BUDGETS.parkInteractive)}`,
    );
  }
  if (overFrame) {
    failures.push(
      `park frame p95 ${park.p95.toFixed(1)}ms > ${BUDGETS.frameP95}ms`,
    );
  }
  rows.push({
    measure: "park first-interactive",
    value: ms(park.interactive),
    budget: ms(BUDGETS.parkInteractive),
    status: overInteractive ? "OVER" : "ok",
  });
  rows.push({
    measure: `park frame p95 (${park.frameCount} frames)`,
    value: `${park.p95.toFixed(1)} ms`,
    budget: `${BUDGETS.frameP95} ms`,
    status: overFrame ? "OVER" : "ok",
  });

  const overDropped = !(park.droppedRatio <= BUDGETS.droppedFrameRatio);
  if (overDropped) {
    failures.push(
      `park dropped ${(park.droppedRatio * 100).toFixed(1)}% of frames > ` +
        `${BUDGETS.droppedFrameRatio * 100}%`,
    );
  }
  rows.push({
    measure: "park dropped frames",
    value: `${(park.droppedRatio * 100).toFixed(1)} %`,
    budget: `${BUDGETS.droppedFrameRatio * 100} %`,
    status: overDropped ? "OVER" : "ok",
  });

  console.table(rows);
  await browser.close();

  if (failures.length > 0) {
    console.error(`\n${failures.length} budget(s) exceeded:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      "\nEither bring the measurement back under budget, or change the budget " +
        "in docs/DESIGN.md and in this file together, with the measurement " +
        "that justifies it.",
    );
    process.exit(1);
  }

  console.log("\nAll latency budgets hold.");
}

await main();
