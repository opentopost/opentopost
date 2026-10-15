import { StartCta } from "./cta";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { HeaderActions } from "./auth-actions";
import { GitHubStars } from "./github-stars";
import { Logo } from "../mark";
import { buttonClass, Eyebrow } from "../ui";
import { MobileMenu } from "./mobile-menu";

export const REPO_URL = "https://github.com/opentopost/opentopost";

export function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const NAV = [
  { href: "/how-it-works", label: "Product" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/self-host", label: "Self-host" },
];

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1148px] px-5 md:px-6 ${className}`}>{children}</div>;
}

function Header() {
  return (
    <header className="sticky top-0 z-40 bg-canvas">
      <Container className="flex h-14 items-center gap-4">
        <Link href="/" aria-label="opentopost home" className="flex-1 md:flex-none">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 justify-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-control px-2 py-1 text-[14px] text-ink hover:bg-fill"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-[14px] text-ink hover:bg-fill"
          >
            <GitHubIcon size={14} />
            GitHub
            <Suspense fallback={null}>
              <GitHubStars />
            </Suspense>
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <HeaderActions />
          <MobileMenu
            links={NAV}
            repoUrl={REPO_URL}
            stars={
              <Suspense fallback={null}>
                <GitHubStars />
              </Suspense>
            }
          />
        </div>
      </Container>
    </header>
  );
}

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/self-host", label: "Self-host" },
      { href: "/security", label: "Security" },
      { href: "/tools/linkedin-photo", label: "Free photo tool" },
      { href: "/docs/agents", label: "Agents and API" },
      { href: "/compare/taplio", label: "vs Taplio" },
      { href: "/compare/everyonesocial", label: "vs EveryoneSocial" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
  {
    title: "Open source",
    links: [
      { href: REPO_URL, label: "GitHub repository" },
      { href: `${REPO_URL}#run-it-locally`, label: "Run it locally" },
      { href: `${REPO_URL}/issues`, label: "Report an issue" },
    ],
  },
  {
    title: "Built with",
    links: [
      { href: "https://www.convex.dev", label: "Convex" },
      { href: "https://kinde.com", label: "Kinde" },
      { href: "https://aistudio.google.com", label: "Google AI Studio" },
    ],
  },
];

function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-[280px] text-[14px] text-muted">
            The content engine for teams that build. Posts from real work, in each person&apos;s voice and your company&apos;s.
          </p>
        </div>
        {FOOTER.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <Eyebrow className="text-[12px]">{column.title}</Eyebrow>
            {column.links.map((link) =>
              link.href.startsWith("/") ? (
                <Link key={link.label} href={link.href} className="text-[14px] text-ink hover:text-accent">
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[14px] text-ink hover:text-accent"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>
        ))}
      </Container>
    </footer>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  tone = "accent",
}: {
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  tone?: "accent" | "sky";
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-end md:gap-16">
      <div className="flex flex-col gap-3">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h2 className="text-[32px] leading-[1.2] font-normal tracking-[-0.02em] md:text-title">{title}</h2>
      </div>
      <p className="text-lead text-body md:pb-1">{body}</p>
    </div>
  );
}

export function StartButtons({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StartCta size={size}>Start free</StartCta>
      <Link href="/self-host" className={buttonClass("secondary", size)}>
        Deploy your own
      </Link>
    </div>
  );
}

export function FeatureRow({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink">
        {icon}
      </span>
      <div>
        <p className="text-[16px] text-ink">{title}</p>
        <p className="text-[14px] text-muted">{body}</p>
      </div>
    </div>
  );
}

export function FinalCta({ title, body }: { title: ReactNode; body: string }) {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="grid-faint absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <Container className="relative flex flex-col items-center gap-5 text-center">
        <Eyebrow>Getting started</Eyebrow>
        <h2 className="max-w-[640px] text-[40px] leading-[1.15] tracking-[-0.03em] md:text-display">{title}</h2>
        <p className="max-w-[560px] text-lead text-body">{body}</p>
        <StartButtons size="lg" />
      </Container>
    </section>
  );
}
