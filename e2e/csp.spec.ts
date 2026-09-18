/**
 * End-to-end tests for the Content-Security-Policy the site is served under.
 *
 * What these guarantee: the policy is actually applied by the running server,
 * and it grants WebAssembly compilation without granting `eval()`. Those two
 * are one directive apart and the difference is invisible everywhere else —
 * the park loads identically under either, so no other test in this suite
 * fails if the narrow grant is widened back to `'unsafe-eval'`.
 *
 * Why the probe is injected into the HTML response rather than run with
 * `page.evaluate`: script that enters the page through the DevTools protocol is
 * exempt from the CSP eval check, so `page.evaluate("eval(...)")` succeeds
 * under any policy at all. It reports "eval works" on a page where eval is in
 * fact blocked, which is the most convincing kind of wrong. Rewriting the
 * document body puts the probe in an ordinary inline script governed by the
 * response's own header.
 *
 * `'unsafe-inline'` is still granted, so the injected probe runs. That is the
 * policy's remaining exception and it is asserted below rather than assumed.
 */

import { test, expect } from "@playwright/test";

/** Compiles the smallest valid WebAssembly module: the 8-byte header alone. */
const PROBE = `<script>
  try { window.__ev = String(eval("1+1")); }
  catch (e) { window.__ev = "BLOCKED:" + e.name; }
  try {
    new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    window.__wasm = "ok";
  } catch (e) { window.__wasm = "BLOCKED:" + e.name; }
</script>`;

test.describe("the served policy", () => {
  test("grants wasm compilation and nothing more", async ({ page, baseURL }) => {
    const url = `${baseURL}/`;
    await page.route(url, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace("</body>", `${PROBE}</body>`);
      await route.fulfill({ response, body });
    });

    await page.goto(url);

    const probe = await page.evaluate(() => ({
      ev: (window as unknown as { __ev?: string }).__ev,
      wasm: (window as unknown as { __wasm?: string }).__wasm,
    }));

    // The Draco decoder compiles its module at runtime, so this must work or
    // the park cannot decode its own geometry.
    expect(probe.wasm, "WebAssembly compilation must be permitted").toBe("ok");
    // And nothing on this site evaluates a string as code.
    expect(probe.ev, "eval() must be blocked by the policy").toMatch(/^BLOCKED:/);
  });

  test("names the narrow grant in the header, on every route", async ({
    request,
  }) => {
    // Checked against the header rather than only through behaviour, because a
    // server that sent no policy at all would fail the test above for the right
    // reason and this one for the clearer one.
    for (const route of ["/", "/arcade", "/about"]) {
      const response = await request.get(route);
      const policy = response.headers()["content-security-policy"] ?? "";
      const scriptSrc =
        policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";

      expect(scriptSrc, route).toContain("'wasm-unsafe-eval'");
      // `'unsafe-eval'` is a substring of `'wasm-unsafe-eval'`, so the absence
      // of the broad grant is asserted on the quoted token, not on the word.
      expect(scriptSrc, route).not.toContain("' unsafe-eval'");
      expect(scriptSrc.replace("'wasm-unsafe-eval'", ""), route).not.toContain(
        "unsafe-eval",
      );
    }
  });
});
