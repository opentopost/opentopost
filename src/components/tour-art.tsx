import { Check, FileText, GitMerge, MessageSquare, TriangleAlert } from "lucide-react";
import { GitHubLogo, LinkedInLogo, SlackLogo } from "@/components/brand-icons";
import { Mark } from "@/components/mark";

/** Small, sharp illustrations of the app for the welcome tour. Drawn in code, so they never blur or go stale. */

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="grid-faint flex h-full w-full items-center justify-center p-5 sm:p-7">{children}</div>;
}

export function MomentsArt() {
  const rows = [
    { score: 83, title: "A checkout bug that only hit slow networks", source: "PR #482", icon: <GitHubLogo size={12} /> },
    { score: 76, title: "The customer who asked for bulk export", source: "#customers", icon: <SlackLogo size={12} /> },
    { score: 64, title: "Cold start cut from 4s to 900ms", source: "PR #470", icon: <GitMerge size={12} strokeWidth={2} /> },
  ];
  return (
    <Frame>
      <div className="flex w-full max-w-[460px] flex-col gap-2">
        <p className="flex items-center justify-between text-[12px] text-muted">
          <span className="font-medium text-ink">This week&apos;s moments</span>
          <span>from GitHub and Slack</span>
        </p>
        {rows.map((row, i) => (
          <div
            key={row.title}
            className={`flex items-center gap-3 rounded-item border bg-surface px-3 py-2.5 ${i === 0 ? "border-accent" : "border-line"}`}
          >
            <span className="w-8 text-[20px] leading-none font-medium tracking-[-0.02em] text-accent">{row.score}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{row.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                {row.icon} {row.source}
              </p>
            </div>
            <span className={`rounded-control px-2 py-1 text-[11px] font-medium ${i === 0 ? "bg-ink text-white" : "border border-line text-ink"}`}>
              {i === 0 ? "Write draft" : "Claim"}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function DraftArt() {
  return (
    <Frame>
      <div className="grid w-full max-w-[520px] grid-cols-[1fr_170px] gap-2.5">
        <div className="flex flex-col gap-2 rounded-item border border-line bg-surface p-3">
          <p className="text-[11px] text-muted">Pick a hook</p>
          {[
            "I spent most of this week chasing a bug that only hit slow networks.",
            "Every log said the payment went through.",
            "The fix was one number.",
          ].map((hook, i) => (
            <p
              key={hook}
              className={`rounded-control border px-2 py-1.5 text-[11px] leading-snug ${i === 0 ? "border-accent bg-accent-soft/50" : "border-line"}`}
            >
              {hook}
            </p>
          ))}
          <p className="mt-1 text-[11px] text-muted">In Ada&apos;s voice, from her past posts</p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-item border border-line bg-surface p-3">
          <p className="text-[11px] font-medium">Claims</p>
          {["Took most of the week", "Timeout was 3 seconds"].map((claim) => (
            <p key={claim} className="flex items-start gap-1.5 text-[11px] leading-snug">
              <Check size={12} strokeWidth={2.4} className="mt-px shrink-0 text-accent" /> {claim}
            </p>
          ))}
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-danger">
            <TriangleAlert size={12} strokeWidth={2.2} className="mt-px shrink-0" /> &quot;Doubled sales&quot; has no source
          </p>
          <span className="mt-auto rounded-control border border-line px-2 py-1 text-center text-[11px] font-medium">Fix it for me</span>
        </div>
      </div>
    </Frame>
  );
}

export function ApproveArt() {
  return (
    <Frame>
      <div className="flex w-full max-w-[460px] flex-col gap-2.5">
        <div className="overflow-hidden rounded-item border border-line bg-surface">
          <div className="flex items-center gap-2 bg-[#350d36] px-3 py-2 text-[12px] font-medium text-white">
            <SlackLogo size={13} /> Direct message
          </div>
          <div className="flex gap-2.5 p-3">
            <Mark size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px]">
                <b>opentopost</b> <span className="text-muted">9:02 AM</span>
              </p>
              <p className="text-[12px]">Your draft is ready.</p>
              <div className="mt-2 border-l-2 border-accent pl-2.5">
                <p className="text-[12px] font-medium">A checkout bug that only hit slow networks</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                  I spent most of this week chasing a bug that only hit slow networks, and every log said the payment went through…
                </p>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <span className="rounded-control bg-[#1f8a4c] px-2.5 py-1 text-[11px] font-medium text-white">Approve</span>
                <span className="rounded-control border border-line px-2.5 py-1 text-[11px] font-medium">Edit</span>
                <span className="rounded-control border border-line px-2.5 py-1 text-[11px] font-medium">Pass</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end rounded-item bg-ink px-3 py-2 text-[12px] font-medium text-white">
          <LinkedInLogo size={13} /> Posts Tuesday, 9:00
        </div>
      </div>
    </Frame>
  );
}

export function RecapArt() {
  return (
    <Frame>
      <div className="flex w-full max-w-[460px] flex-col gap-2.5">
        <p className="text-[13px] font-medium">Week of 12 Oct</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-item border border-line bg-surface p-3">
            <p className="font-mono text-[10px] text-muted uppercase">Shipped</p>
            <p className="mt-1 text-[36px] leading-none font-medium tracking-[-0.04em]">14</p>
          </div>
          <div className="rounded-item border border-line bg-surface p-3">
            <p className="font-mono text-[10px] text-muted uppercase">Told</p>
            <p className="mt-1 text-[36px] leading-none font-medium tracking-[-0.04em] text-accent">3</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-item bg-accent-soft px-3 py-2 text-[12px] font-medium text-accent-deep">
          <MessageSquare size={13} strokeWidth={2} /> 11 moments nobody told yet
        </div>
        <div className="flex items-center gap-2 rounded-item border border-line bg-surface px-3 py-2 text-[12px]">
          <FileText size={13} strokeWidth={1.75} className="text-muted" /> SSO for enterprise workspaces
          <span className="ml-auto rounded-control border border-line px-2 py-0.5 text-[11px]">Write a draft</span>
        </div>
      </div>
    </Frame>
  );
}
