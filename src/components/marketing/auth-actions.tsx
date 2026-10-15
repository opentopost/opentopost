"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "../ui";
import { SignInCta, StartCta, useSiteGate } from "./cta";

/** Sign in and Start free for visitors (or Book a demo in demo mode), Dashboard for people already signed in. */
export function HeaderActions() {
  const { isAuthenticated, isLoading } = useKindeBrowserClient();
  const gate = useSiteGate();
  // Keep the space while Kinde checks the session, so the header does not jump.
  if (isLoading || gate.loading) return <span aria-hidden="true" className="inline-block h-8 w-[104px]" />;
  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={buttonClass("primary")}>
        Dashboard
        <ArrowUpRight size={14} strokeWidth={1.75} />
      </Link>
    );
  }
  if (gate.returning) return <SignInCta size="sm" variant="primary" />;
  return (
    <>
      <SignInCta className="max-md:hidden" />
      <StartCta size="sm">
        Start free
        <ArrowUpRight size={14} strokeWidth={1.75} />
      </StartCta>
    </>
  );
}

export function MobileAuthAction() {
  const { isAuthenticated, isLoading } = useKindeBrowserClient();
  const gate = useSiteGate();
  if (isLoading || gate.loading) return null;
  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={buttonClass("secondary", "lg", "w-full")}>
        Open dashboard
      </Link>
    );
  }
  return <SignInCta size="lg" variant="secondary" className="w-full" />;
}
