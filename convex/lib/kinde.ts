/** Kinde Management API access with a machine-to-machine app. Optional: returns null when not set up. */

export function kindeIssuer(): string | null {
  return process.env.KINDE_ISSUER_URL?.replace(/\/$/, "") ?? null;
}

export function m2mConfigured(): boolean {
  return Boolean(kindeIssuer() && process.env.KINDE_M2M_CLIENT_ID && process.env.KINDE_M2M_CLIENT_SECRET);
}

export async function m2mToken(): Promise<string | null> {
  const issuer = kindeIssuer();
  const clientId = process.env.KINDE_M2M_CLIENT_ID;
  const clientSecret = process.env.KINDE_M2M_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `${issuer}/api`,
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export async function kindeApi<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${kindeIssuer()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Kinde API ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export type OrgBilling = {
  billing?: {
    billing_customer_id?: string;
    agreements?: { plan_code?: string; agreement_id?: string }[];
  };
};
