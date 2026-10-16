import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { Container, MarketingShell } from "@/components/marketing/shell";
import { buttonClass, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/tools", label: "Free tools" },
  { href: "/self-host", label: "Self-host" },
];

export default function NotFound() {
  return (
    <MarketingShell>
      <Container>
        <div className="grid items-center gap-12 pt-16 pb-24 md:grid-cols-[1fr_1fr] md:gap-16 md:pt-24">
          <div className="flex flex-col items-start gap-6">
            <Eyebrow>Error 404</Eyebrow>
            <h1 className="text-[40px] leading-[1.12] tracking-[-0.03em] md:text-display">This page never made it to the feed</h1>
            <p className="max-w-[460px] text-lead text-body">
              The link is wrong, or the page moved. Your workspace and your posts are fine. Pick up where you left off.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={buttonClass("primary", "lg")}>
                Go to the home page
              </Link>
              <Link href="/dashboard" className={buttonClass("secondary", "lg")}>
                Open the app
              </Link>
            </div>
            <nav aria-label="Pages" className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-[14px]">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-ink underline decoration-line underline-offset-4 hover:text-accent">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* A draft card that never went out, in the same style as the product. */}
          <div aria-hidden className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute inset-x-6 -bottom-3 h-full rounded-card border border-line bg-surface/60" />
            <div className="relative rounded-card border border-line bg-surface p-5 shadow-[0_1px_0_rgb(0_0_0/0.03)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mark size={32} />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-ink">opentopost</span>
                    <span className="text-[12px] text-muted">Draft</span>
                  </div>
                </div>
                <span className="rounded-full bg-danger-soft px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-danger">NOT FOUND</span>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ink">We looked everywhere for this page.</p>
              <p className="mt-3 text-[15px] leading-relaxed text-body">The sources are connected, the ideas are ready, the voice is trained. The one thing missing is the URL.</p>
              <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 font-mono text-[12px] text-faint">
                <span className="inline-block size-1.5 rounded-full bg-danger" />
                <span>/404 · nothing scheduled here</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </MarketingShell>
  );
}
