"use node";

import { createSign } from "node:crypto";
import { internalAction } from "./_generated/server";

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google Docs is not set up on this deployment.");
  const parsed = JSON.parse(raw) as ServiceAccount;
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** A one-hour Drive token for the service account. It can read only what people share with that account. */
export const driveToken = internalAction({
  args: {},
  handler: async (): Promise<string> => {
    const account = serviceAccount();
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${base64url(signer.sign(account.private_key))}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!response.ok) throw new Error("Google did not accept the service account.");
    const body = (await response.json()) as { access_token: string };
    return body.access_token;
  },
});
