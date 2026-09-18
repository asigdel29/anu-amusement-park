/**
 * Next configuration.
 *
 * Contract: fails the build on a type error or a lint error, serves the site under
 * a closed Content-Security-Policy, and caches the baked park assets immutably.
 *
 * Invariants:
 *   1. The CSP names no third-party origin. Fonts are self-hosted by next/font and
 *      the Draco and KTX2 decoders are vendored under /public, so every byte the
 *      page loads comes from this origin. Adding a CDN here would silently reopen
 *      that surface; vendor the dependency instead.
 *   2. Anything under /models or /draco or /basis is content-addressed by the build
 *      that produced it and may be cached forever. A re-bake changes the filename,
 *      never the contents at a filename — see docs/ASSETS.md.
 */

import type { NextConfig } from "next";

/**
 * `unsafe-eval` is required by the Draco and KTX2 decoders, which compile their
 * WebAssembly modules at runtime. It is scoped to script-src and cannot be
 * narrowed further without dropping compressed assets entirely, which would cost
 * more than it buys. `worker-src blob:` is required for the same decoders' worker
 * pool. No other directive admits an exception.
 */
const directives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

/**
 * `upgrade-insecure-requests` is emitted only where the deployment is actually
 * served over HTTPS.
 *
 * WebKit applies the directive to loopback addresses as well, so against a
 * local HTTP server it rewrites every navigation to `https://127.0.0.1:<port>`,
 * finds no TLS listener, and aborts — silently, as a dead link rather than as
 * an error. Chromium and Firefox exempt loopback, which is why this surfaced as
 * 28 WebKit-only end-to-end failures and nothing else.
 *
 * Dropping it locally costs nothing: on a site served wholly over HTTPS with no
 * mixed content, the directive has nothing left to upgrade. It stays on in
 * production, where subresource drift is the thing it exists to catch.
 */
if (process.env.VERCEL) {
  directives.push("upgrade-insecure-requests");
}

const contentSecurityPolicy = directives.join("; ");

const nextConfig: NextConfig = {
  // Next 16 removed the built-in ESLint build step, so linting is a separate gate
  // rather than a config flag here; see the `check` script and .github/workflows.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/:dir(models|draco|basis)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
