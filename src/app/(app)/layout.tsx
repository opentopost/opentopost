import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { AppLoader } from "@/components/loader";

export const metadata: Metadata = {
  title: "App",
  robots: { index: false, follow: false },
};

// The signed-in app loads its data in the browser after sign-in, so its pages are not
// prerendered for instant navigation. This turns off that check for the app only.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppLoader step={0} />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
