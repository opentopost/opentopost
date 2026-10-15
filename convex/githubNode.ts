"use node";

import { createSign } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** A short-lived JWT that signs requests as the GitHub App. */
function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const key = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !key) throw new Error("GitHub is not set up on this deployment.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64url(signer.sign(key))}`;
}

/** An installation token, valid for one hour, limited to the repositories the customer chose. */
export const installationToken = internalAction({
  args: { installationId: v.number() },
  handler: async (_ctx, args): Promise<string> => {
    const response = await fetch(`https://api.github.com/app/installations/${args.installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "opentopost",
      },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status} for the installation token.`);
    const body = (await response.json()) as { token: string };
    return body.token;
  },
});
