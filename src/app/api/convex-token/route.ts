import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated())) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  if (request.nextUrl.searchParams.has("refresh")) {
    await session.refreshTokens();
  }
  return NextResponse.json(
    { token: await session.getIdTokenRaw() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
