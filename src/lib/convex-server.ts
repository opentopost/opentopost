import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ConvexHttpClient } from "convex/browser";

/** A Convex client that acts as the signed-in user, for route handlers. */
export async function convexAsUser(): Promise<ConvexHttpClient | null> {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated())) return null;
  const token = await session.getIdTokenRaw();
  if (!token) return null;
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  return client;
}

export function convexErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") return error.data;
  return fallback;
}
