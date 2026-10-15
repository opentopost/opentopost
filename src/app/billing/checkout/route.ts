import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { convexAsUser, convexErrorMessage } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/settings/billing?error=${encodeURIComponent(error)}`, origin));
  const plan = request.nextUrl.searchParams.get("plan");
  const workspaceId = request.nextUrl.searchParams.get("ws");
  if ((plan !== "pro" && plan !== "team") || !workspaceId) return back("Choose a plan.");

  const convex = await convexAsUser();
  if (!convex) return NextResponse.redirect(new URL("/api/auth/login?post_login_redirect_url=/settings/billing", origin));

  try {
    const next = await convex.mutation(api.billing.startCheckout, {
      workspaceId: workspaceId as Id<"workspaces">,
      plan,
    });
    if (next.kind === "portal") {
      const portal = `/api/auth/portal?subNav=organization_plan_selection&returnUrl=${encodeURIComponent(`${origin}/settings/billing?changed=1`)}`;
      const url = new URL("/api/auth/login", origin);
      url.searchParams.set("org_code", next.orgCode);
      url.searchParams.set("post_login_redirect_url", portal);
      return NextResponse.redirect(url);
    }
    const url = new URL("/api/auth/register", origin);
    url.searchParams.set("is_create_org", "true");
    url.searchParams.set("org_name", next.orgName);
    url.searchParams.set("plan_interest", next.planKey);
    url.searchParams.set("post_login_redirect_url", `/billing/complete?intent=${next.token}`);
    return NextResponse.redirect(url);
  } catch (error) {
    return back(convexErrorMessage(error, "The upgrade did not start. Try again."));
  }
}
