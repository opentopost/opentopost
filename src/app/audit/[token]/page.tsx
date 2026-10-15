"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Quote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Logo } from "@/components/mark";
import { buttonClass, Spinner } from "@/components/ui";

const KIND_TONE: Record<string, string> = {
  measured: "bg-lime text-lime-ink",
  customer: "bg-sky text-sky-deep",
  shipped: "bg-accent-soft text-accent-deep",
  milestone: "bg-accent-soft text-accent-deep",
};

export default function AuditPage() {
  const params = useParams<{ token: string }>();
  const audit = useQuery(api.audits.byToken, { token: params.token });

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-[880px] items-center justify-between px-5 py-5">
        <Link href="/" aria-label="opentopost home">
          <Logo />
        </Link>
        <Link href="/" className="text-[13px] text-muted hover:text-ink">
          What is this?
        </Link>
      </header>
      <div className="mx-auto flex max-w-[880px] flex-col gap-8 px-5 pb-20">
        {audit === undefined ? (
          <div className="flex items-center gap-2 py-24 text-muted">
            <Spinner /> Loading the audit
          </div>
        ) : audit === null ? (
          <p className="py-24 text-muted">This audit does not exist or was deleted.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 pt-6">
              <p className="font-mono text-[12px] tracking-wide text-accent-deep uppercase">Distribution audit</p>
              <h1 className="text-[34px] leading-[1.1] tracking-[-0.03em] md:text-[44px]">
                {audit.status === "ready"
                  ? `${audit.stories.length} stories ${audit.workspace} has not told yet`
                  : audit.status === "running"
                    ? `Reading what ${audit.workspace} shipped`
                    : "No stories found yet"}
              </h1>
              <p className="max-w-[620px] text-[16px] text-body">
                {audit.status === "running"
                  ? "opentopost is reading the last 30 days from every connected source. This page updates by itself in a few minutes."
                  : audit.status === "failed"
                    ? audit.error
                    : `From the last 30 days of ${audit.sources.join(", ") || "your sources"}. Each story is something the team really did, with the person who should tell it and the quote that proves it.`}
              </p>
              {audit.status === "running" && (
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <Spinner /> Working
                </div>
              )}
            </div>
            {audit.status === "ready" && (
              <ol className="flex flex-col gap-3">
                {audit.stories.map((story, index) => (
                  <li key={index} className="flex gap-4 rounded-card border border-line bg-surface p-5">
                    <span className="w-8 shrink-0 font-mono text-[20px] text-accent-deep tabular-nums">{index + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${KIND_TONE[story.kind] ?? "bg-fill text-body"}`}>{story.kind}</span>
                        <span className="text-[12px] text-muted">For {story.person}</span>
                      </div>
                      <h2 className="text-[17px] leading-snug font-medium text-ink">{story.title}</h2>
                      <p className="text-[14px] leading-relaxed text-body">{story.why}</p>
                      {story.quote && (
                        <p className="flex gap-2 rounded-item bg-canvas px-3 py-2 text-[13px] text-body">
                          <Quote size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent-deep" />
                          <span>
                            {story.quote}
                            {story.sourceTitle && <span className="text-muted"> · {story.sourceTitle}</span>}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-accent-soft/40 p-6">
              <p className="text-[18px] font-medium">Turn these into posts, in each person&apos;s own voice</p>
              <p className="text-[14px] text-body">opentopost drafts each story for the person who did the work, checks every claim against its source, and shows which posts brought signups.</p>
              <Link href="/" className={buttonClass("primary", "md")}>
                See how it works <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
