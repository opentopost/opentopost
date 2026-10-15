import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.KINDE_ISSUER_URL!,
      applicationID: process.env.KINDE_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
