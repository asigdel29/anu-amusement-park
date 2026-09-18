/**
 * Vitest configuration — unit and contract tests only.
 *
 * Contract: `npm run test` runs every `tests/**\/*.test.ts(x)` in a jsdom
 * environment with the `@/` alias resolving as it does in the application.
 *
 * Scope boundary: nothing here renders a WebGL context. Tests that need a real
 * browser (pin picking against a live canvas, keyboard traversal, the no-WebGL
 * path) belong in `e2e/` and run under Playwright. Mixing the two is how a suite
 * ends up mocking the thing it was meant to verify.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
