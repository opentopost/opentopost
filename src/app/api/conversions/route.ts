import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const TYPES = ["signup", "demo", "application", "purchase"] as const;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  let body: { key?: unknown; ref?: unknown; type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send JSON." }, { status: 400, headers: CORS });
  }
  const type = TYPES.find((value) => value === body.type);
  if (typeof body.key !== "string" || !type) {
    return NextResponse.json({ ok: false, error: "Send a key and a type." }, { status: 400, headers: CORS });
  }
  const ok = await convex.mutation(api.links.recordConversion, {
    key: body.key,
    type,
    ref: typeof body.ref === "string" && /^[a-z0-9]{4,16}$/.test(body.ref) ? body.ref : undefined,
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 401, headers: CORS });
}
