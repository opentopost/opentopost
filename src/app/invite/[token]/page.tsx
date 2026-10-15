import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteView } from "@/components/invite-view";

export const metadata: Metadata = {
  title: "Join a workspace",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function InvitePage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <InviteView />
    </Suspense>
  );
}
