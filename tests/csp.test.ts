/**
 * Contract tests for the Content-Security-Policy in next.config.ts.
 *
 * What this guards: that the eval grant is narrow in what ships and wide enough
 * in `next dev`, which are two different answers from one config module.
 *
 * Why it exists at this level. `e2e/csp.spec.ts` asserts the shipped policy's
 * behaviour in a real browser, but every suite in this repo — e2e, regression,
 * perf — runs against `next start`. Nothing runs against the dev server. When
 * `script-src` was first narrowed to `'wasm-unsafe-eval'` alone, all 216 e2e
 * tests passed while `npm run dev` was quietly broken: the Turbopack dev runtime
 * evaluates the React server-components payload with `eval`, so it logged
 * "eval() is not supported in this environment" and lost the dev runtime, while
 * still rendering enough of the page to look correct at a glance.
 *
 * A test that starts a dev server would be slow and flaky for what is really a
 * one-line branch, so this reads the config the way Next does — by importing it
 * under each NODE_ENV — and asserts both answers. Module state is reset between
 * the two, because the grant is decided once at module load.
 */

import { describe, expect, it, vi, afterEach } from "vitest";

/** Reads `script-src` out of the config's own header, as Next would emit it. */
async function scriptSrc(nodeEnv: "development" | "production") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);

  const config = (await import("../next.config")).default;
  const headers = await config.headers!();
  const policy = headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key.toLowerCase() === "content-security-policy");

  expect(policy, `no CSP header is emitted in ${nodeEnv}`).toBeDefined();
  const directive = policy!.value
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src"));

  expect(directive, `no script-src directive in ${nodeEnv}`).toBeDefined();
  return directive!;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the eval grant", () => {
  it("is WebAssembly-only in what ships", async () => {
    const directive = await scriptSrc("production");

    // The Draco decoder compiles its module at runtime and needs this.
    expect(directive).toContain("'wasm-unsafe-eval'");
    // `'unsafe-eval'` is a substring of `'wasm-unsafe-eval'`, so the broad grant
    // is checked for on the remainder rather than on the word itself.
    expect(directive.replace("'wasm-unsafe-eval'", "")).not.toContain(
      "unsafe-eval",
    );
  });

  it("admits eval in `next dev`, which cannot run without it", async () => {
    const directive = await scriptSrc("development");

    expect(directive).toContain("'unsafe-eval'");
  });
});
