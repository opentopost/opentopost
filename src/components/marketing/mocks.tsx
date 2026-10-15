import {
  ChartLine,
  FileText,
  GitPullRequest,
  Lightbulb,
  MessageSquare,
  PenLine,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { Mark } from "../mark";

const IDEAS = [
  {
    title: "We cut onboarding from nine steps to three",
    source: "#product thread",
    icon: <MessageSquare size={12} strokeWidth={1.75} />,
    score: 92,
    who: "AO",
  },
  {
    title: "What 40 customer calls taught us about pricing pages",
    source: "Call notes",
    icon: <FileText size={12} strokeWidth={1.75} />,
    score: 87,
    who: "TB",
  },
  {
    title: "How we shipped our MCP server in a weekend",
    source: "Pull request",
    icon: <GitPullRequest size={12} strokeWidth={1.75} />,
    score: 81,
    who: "MK",
  },
  {
    title: "The support ticket that changed our roadmap",
    source: "Support inbox",
    icon: <MessageSquare size={12} strokeWidth={1.75} />,
    score: 74,
    who: "SJ",
  },
];

const HOOKS = [
  "We deleted six onboarding steps last week. Activation went up.",
  "Our onboarding had nine steps. Users finished three.",
  "The fastest way to fix onboarding is to remove it.",
];

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-[5px] bg-sky-mid text-[9px] font-semibold text-ink">
      {initials}
    </span>
  );
}

export function AppWindow({
  tab,
  children,
  className = "",
}: {
  tab: "Ideas" | "Drafts" | "Recap";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-line bg-canvas shadow-[0_24px_48px_-24px_rgb(16_16_16/0.25)] ${className}`}
      aria-hidden="true"
    >
      <div className="flex h-10 items-center gap-3 border-b border-line bg-surface px-3">
        <Mark size={16} />
        <span className="text-[12px] font-medium">Acme workspace</span>
        <div className="mx-auto hidden rounded-control bg-fill p-0.5 sm:flex">
          {(["Ideas", "Drafts", "Recap"] as const).map((name) => (
            <span
              key={name}
              className={`rounded-[4px] px-2.5 py-0.5 text-[11px] ${
                name === tab ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"
              }`}
            >
              {name}
            </span>
          ))}
        </div>
        <span className="ml-auto rounded-[4px] bg-accent px-2 py-0.5 text-[11px] font-medium text-white sm:ml-0">
          Find ideas
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-11 shrink-0 flex-col items-center gap-3 border-r border-line bg-surface/60 py-3 text-muted sm:flex">
          <Lightbulb size={14} strokeWidth={1.75} className="text-ink" />
          <PenLine size={14} strokeWidth={1.75} />
          <ChartLine size={14} strokeWidth={1.75} />
          <Settings size={14} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function IdeasList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[12px] font-medium">This week</span>
        <span className="text-[11px] text-muted">From Slack, notes and GitHub</span>
      </div>
      {IDEAS.slice(0, rows).map((idea, index) => (
        <div
          key={idea.title}
          className={`flex items-center gap-3 rounded-item border bg-surface px-3 py-2.5 ${
            index === 0 ? "border-accent" : "border-line"
          }`}
        >
          <span className="w-7 shrink-0 font-mono text-[12px] text-accent">{idea.score}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink">{idea.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              {idea.icon}
              {idea.source}
            </p>
          </div>
          <Avatar initials={idea.who} />
          <span
            className={`hidden rounded-[4px] px-2 py-0.5 text-[11px] sm:inline ${
              index === 0 ? "bg-ink text-white" : "border border-line text-ink"
            }`}
          >
            {index === 0 ? "Claimed" : "Claim"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DraftPanel() {
  return (
    <div className="flex flex-col gap-3 border-l border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium">Draft in Ada&apos;s voice</span>
        <span className="rounded-[4px] bg-lime px-1.5 text-[10px] font-medium text-lime-ink">Ready</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Pick a hook</span>
        {HOOKS.map((hook, index) => (
          <div
            key={hook}
            className={`rounded-control border px-2 py-1.5 text-[11px] leading-snug ${
              index === 0 ? "border-accent bg-accent-soft/50" : "border-line"
            }`}
          >
            {hook}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Post</span>
        <div className="flex flex-col gap-1 rounded-control bg-fill p-2">
          <span className="h-1.5 w-full rounded-full bg-ink/15" />
          <span className="h-1.5 w-11/12 rounded-full bg-ink/15" />
          <span className="h-1.5 w-4/5 rounded-full bg-ink/15" />
          <span className="h-1.5 w-2/3 rounded-full bg-ink/15" />
        </div>
      </div>
      <span className="rounded-[4px] bg-ink py-1.5 text-center text-[11px] font-medium text-white">
        Copy and open LinkedIn
      </span>
    </div>
  );
}

export function HeroPreview() {
  return (
    <AppWindow tab="Ideas">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <IdeasList />
        <div className="hidden md:block">
          <DraftPanel />
        </div>
      </div>
    </AppWindow>
  );
}

export function RecapMock() {
  const stats = [
    { label: "Posts", value: "14" },
    { label: "Link clicks", value: "386" },
    { label: "People posting", value: "6 of 8" },
  ];
  return (
    <AppWindow tab="Recap">
      <div className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-item border border-line bg-surface p-2.5">
              <p className="text-[10px] text-muted">{stat.label}</p>
              <p className="text-[18px] font-medium tracking-[-0.02em]">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-item border border-line bg-surface p-2.5">
          <p className="mb-2 text-[11px] font-medium">Top posts this week</p>
          {["We cut onboarding from nine steps to three", "What 40 customer calls taught us", "Our first hire in Lagos"].map(
            (post, index) => (
              <div key={post} className="flex items-center gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="font-mono text-[11px] text-accent">{index + 1}</span>
                <span className="truncate text-[11px]">{post}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </AppWindow>
  );
}

export function TerminalMock() {
  const lines = [
    { prompt: true, text: "git clone github.com/opentopost/opentopost" },
    { prompt: true, text: "npm install" },
    { prompt: true, text: "npx convex dev" },
    { prompt: false, text: "Convex functions ready" },
    { prompt: true, text: "npx convex env set KINDE_ISSUER_URL ..." },
    { prompt: true, text: "npx vercel deploy --prod" },
    { prompt: false, text: "Ready on https://posts.yourcompany.com" },
  ];
  return (
    <div
      className="overflow-hidden rounded-[12px] border border-white/10 bg-ink shadow-[0_24px_48px_-24px_rgb(16_16_16/0.4)]"
      aria-hidden="true"
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-white/10 px-3">
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-col gap-1.5 p-4 font-mono text-[12px]">
        {lines.map((line) => (
          <p key={line.text} className={line.prompt ? "text-white" : "text-sky-mid"}>
            {line.prompt ? <span className="text-accent-mid">$ </span> : "✓ "}
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
