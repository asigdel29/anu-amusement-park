import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored third-party decoders. They are copied verbatim from
    // three/examples/jsm/libs/ so that the CSP can keep `connect-src 'self'`
    // with no CDN exception — see docs/ASSETS.md. Emscripten output is not
    // ours to lint, and linting it buries every real finding under ten
    // thousand warnings about a generated file.
    "public/draco/**",
    "public/basis/**",

    // Playwright output.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
