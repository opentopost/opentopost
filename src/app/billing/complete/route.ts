import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { convexAsUser, convexErrorMessage } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (query: string) => NextResponse.redirect(new URL(`/settings/billing?${query}`, origin));
  const token = request.nextUrl.searchParams.get("intent");
  if (!token) return back("error=" + encodeURIComponent("The upgrade link is missing a step. Start again."));

  const convex = await convexAsUser();
  const organization = await getKindeServerSession().getOrganization();
  if (!convex || !organization?.orgCode) {
    return back("error=" + encodeURIComponent("We could not read your new organization. Sign in again, then try again."));
  }
  try {
    await convex.mutation(api.billing.completeCheckout, { token, orgCode: organization.orgCode });
    return back("upgraded=1");
  } catch (error) {
    return back("error=" + encodeURIComponent(convexErrorMessage(error, "The upgrade did not finish. Try again.")));
  }
}
