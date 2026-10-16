import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, GitHubIcon, MarketingShell, REPO_URL } from "@/components/marketing/shell";
import { Eyebrow } from "@/components/ui";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("tools");

const TOOLS = [
  {
    href: "/tools/linkedin-photo",
    tag: "Photo",
    title: "LinkedIn photo tool",
    body: "Crop to the circle, fix the light, add a ring with your tag, and see it on a profile, a post and a comment before you upload.",
    tone: "bg-accent-soft",
  },
];

export default function Tools() {
  return (
    <MarketingShell>
      <Container>
        <PageHero
          eyebrow="Free tools"
          title="Small tools that make your LinkedIn better today"
          body="No account, no upload, no fee. Each tool runs on your device, so your photo and your words stay with you."
        />
        <section aria-label="Tools" className="grid gap-4 pb-12 md:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface/80 transition-colors hover:border-accent-mid"
            >
              <div className={`flex h-[180px] items-center justify-center ${tool.tone}`}>
                <div className="flex items-center gap-3" aria-hidden>
                  <span className="size-24 rounded-full border-4 border-accent bg-surface shadow-sm" />
                  <span className="size-14 rounded-full border-2 border-accent-mid bg-surface" />
                  <span className="size-9 rounded-full border-2 border-accent-mid bg-surface" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                <Eyebrow>{tool.tag}</Eyebrow>
                <h2 className="text-[22px] leading-tight tracking-[-0.02em] text-ink">{tool.title}</h2>
                <p className="text-[15px] leading-relaxed text-body">{tool.body}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-ink group-hover:text-accent">
                  Open the tool <ArrowRight size={14} strokeWidth={1.75} />
                </span>
              </div>
            </Link>
          ))}

          <a
            href={`${REPO_URL}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col justify-between gap-6 rounded-card border border-dashed border-line bg-transparent p-6 transition-colors hover:border-accent-mid"
          >
            <div className="flex flex-col gap-3">
              <Eyebrow tone="muted">More on the way</Eyebrow>
              <h2 className="text-[22px] leading-tight tracking-[-0.02em] text-ink">What should we build next?</h2>
              <p className="text-[15px] leading-relaxed text-body">
                Tell us the small LinkedIn job you do by hand every week, and it may become the next free tool.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
              <GitHubIcon size={14} /> Suggest a tool
            </span>
          </a>
        </section>

        <div className="flex items-center gap-2 pb-24 text-[13px] text-muted">
          <Lock size={13} strokeWidth={1.75} />
          Everything here runs in your browser. Nothing you add is sent to us.
        </div>
      </Container>
      <FinalCta title="Tools help one person. opentopost helps the whole team post." body="It turns the work your team already does into LinkedIn posts, written in each person's own voice." />
    </MarketingShell>
  );
}
