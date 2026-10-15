import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { convexAsUser } from "@/lib/convex-server";

const PAGES = new Set(["organization_plan_details", "organization_payment_details", "organization_plan_selection"]);

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const workspaceId = request.nextUrl.searchParams.get("ws");
  const page = request.nextUrl.searchParams.get("page") ?? "organization_plan_details";
  const convex = await convexAsUser();
  if (!convex || !workspaceId) return NextResponse.redirect(new URL("/settings/billing", origin));

  const status = await convex.query(api.billing.status, { workspaceId: workspaceId as Id<"workspaces"> }).catch(() => null);
  if (!status?.billingOrgCode) {
    return NextResponse.redirect(
      new URL(`/settings/billing?error=${encodeURIComponent("Only the owner of a paid workspace can manage billing.")}`, origin),
    );
  }
  const portal = `/api/auth/portal?subNav=${PAGES.has(page) ? page : "organization_plan_details"}&returnUrl=${encodeURIComponent(`${origin}/settings/billing?changed=1`)}`;
  const url = new URL("/api/auth/login", origin);
  url.searchParams.set("org_code", status.billingOrgCode);
  url.searchParams.set("post_login_redirect_url", portal);
  return NextResponse.redirect(url);
}
