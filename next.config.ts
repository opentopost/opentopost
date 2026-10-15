import type { NextConfig } from "next";

const APP_PATHS = [
  "/dashboard",
  "/ideas",
  "/drafts",
  "/sources",
  "/voice",
  "/settings",
  "/onboarding",
  "/start",
  "/invite",
  "/moments",
  "/review",
  "/recap",
  "/calendar",
  "/company",
  "/billing",
  "/insights",
  "/audit",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Hides the Next.js badge in development, so screenshots of the app stay clean.
  devIndicators: false,
  // The admin dashboard runs on admin.localhost:3000 in development.
  allowedDevOrigins: ["admin.localhost"],
  partialPrefetching: true,
  experimental: {
    // The signed-in app is rendered in the browser after sign-in, so only check
    // instant navigation where a page or layout asks for it with `instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Agents reach the API and the MCP server on the site's own address.
  async rewrites() {
    const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
    const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? cloud?.replace(".convex.cloud", ".convex.site");
    if (!site) return [];
    return [
      { source: "/mcp", destination: `${site}/mcp` },
      { source: "/api/v1", destination: `${site}/api/v1` },
      { source: "/api/v1/:tool", destination: `${site}/api/v1/:tool` },
    ];
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none';" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
    ];
    return [
      { source: "/:path*", headers: security },
      ...APP_PATHS.map((path) => ({
        source: `${path}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })).concat(
        APP_PATHS.map((path) => ({
          source: path,
          headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
        })),
      ),
    ];
  },
};

export default nextConfig;
