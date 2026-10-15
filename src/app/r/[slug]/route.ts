import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let target: string | null = null;
  if (/^[a-z0-9]{4,16}$/.test(slug)) {
    try {
      target = await convex.mutation(api.links.recordClick, {
        slug,
        referrer: request.headers.get("referer") ?? undefined,
      });
    } catch {
      target = null;
    }
  }
  return NextResponse.redirect(target ?? new URL("/", request.url), { status: 302 });
}
