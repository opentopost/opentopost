import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Distribution audit",
  robots: { index: false, follow: false },
};

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>{children}</Suspense>;
}
