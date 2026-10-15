import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/start",
  "/dashboard",
  "/onboarding",
  "/ideas",
  "/moments",
  "/review",
  "/recap",
  "/calendar",
  "/company",
  "/drafts",
  "/sources",
  "/voice",
  "/settings",
  "/billing",
  "/insights",
];

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED.some((prefix) => isUnder(pathname, prefix))) {
    return withAuth(request, { isReturnToCurrentPage: true });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|screens/|brand/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
