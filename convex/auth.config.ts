import type { AuthConfig } from "convex/server";

/*
 * Kinde signs real users in. The demo at demo.opentopost.com signs in with a short-lived token that
 * the site signs itself. That provider is only added when the demo keys are set,
 * so self-hosted installs never trust it.
 */
const demoProviders = process.env.DEMO_JWKS_URL && process.env.DEMO_JWT_ISSUER
  ? [
      {
        type: "customJwt" as const,
        applicationID: "opentopost-demo",
        issuer: process.env.DEMO_JWT_ISSUER,
        jwks: process.env.DEMO_JWKS_URL,
        algorithm: "RS256" as const,
      },
    ]
  : [];

export default {
  providers: [
    {
      domain: process.env.KINDE_ISSUER_URL!,
      applicationID: process.env.KINDE_CLIENT_ID!,
    },
    ...demoProviders,
  ],
} satisfies AuthConfig;
