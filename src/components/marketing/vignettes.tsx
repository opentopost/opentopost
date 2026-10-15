import {
  ArrowRight,
  Building2,
  Check,
  FileText,
  GitPullRequest,
  Hash,
  ImageIcon,
  Link2,
  Mic,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

/*
 * Illustrations for the homepage: small, crafted pieces of the product caught
 * in the middle of doing something. The How it works page uses real screenshots.
 */

type Tone = "accent" | "sky" | "butter";

const PAPER: Record<Tone, string> = {
  accent: "grid-paper",
  sky: "grid-paper grid-paper-sky",
  butter: "grid-paper grid-paper-butter",
};

function Stage({ tone = "accent", label, children, className = "" }: { tone?: Tone; label: string; children: ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={label} className={`relative min-w-0 overflow-hidden rounded-card border border-line p-4 sm:p-6 md:p-8 ${PAPER[tone]} ${className}`}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[12px] border border-line bg-surface text-left shadow-[0_24px_48px_-28px_rgb(16_16_16/0.4)] ${className}`}>{children}</div>
  );
}

const AVATAR = {
  accent: "bg-accent-soft text-accent-deep",
  sky: "bg-sky text-sky-deep",
  butter: "bg-butter-mid text-[#6b5200]",
  lime: "bg-lime text-lime-ink",
  ink: "bg-ink text-white",
};

function Avatar({ initials, tone = "accent", size = 24 }: { initials: string; tone?: keyof typeof AVATAR; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${AVATAR[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}

function Step({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-wide text-ink/60 uppercase">
      <span className={`size-1.5 rounded-full ${live ? "otp-pulse bg-accent" : "bg-ink/30"}`} />
      {children}
    </p>
  );
}

function Tag({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "plain" | "sky" | "lime" | "danger" }) {
  const tones = {
    accent: "bg-accent-soft text-accent-deep",
    plain: "bg-fill text-ink",
    sky: "bg-sky text-sky-deep",
    lime: "bg-lime text-lime-ink",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function Quote({ children, source }: { children: ReactNode; source: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-canvas/50 px-3 py-2.5">
      <p className="border-l-2 border-accent-mid pl-2.5 text-[12px] leading-relaxed text-body">{children}</p>
      <p className="mt-1.5 text-[11px] text-muted">{source}</p>
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
      <Sparkles size={12} strokeWidth={1.75} className="shrink-0 text-accent-deep" />
      <span className="text-[11px] text-muted">{label}</span>
      <span className="relative ml-auto h-1 w-20 overflow-hidden rounded-full bg-fill">
        <span className="otp-bar absolute inset-y-0 left-0 w-1/2 rounded-full bg-accent" />
      </span>
    </div>
  );
}

const Caret = () => <span className="otp-caret ml-px inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-accent" />;

/* ------------------------------------------------------------------------ */

/** Hero: a Slack message becomes a moment, and the moment becomes a draft. */
export function HeroVignette() {
  return (
    <Stage label="A Slack message about a customer result becomes a moment with its quote, then a LinkedIn draft being written in the engineer's voice">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center">
        <div className="flex flex-col gap-3 lg:-translate-y-6">
          <Step>Read from Slack</Step>
          <Panel>
            <div className="flex items-center gap-1.5 border-b border-line px-4 py-2 text-[12px] font-medium text-ink">
              <Hash size={12} strokeWidth={2} /> customers
            </div>
            <div className="flex gap-2.5 px-4 py-3">
              <Avatar initials="KO" tone="lime" size={28} />
              <div className="min-w-0">
                <p className="text-[12px]">
                  <span className="font-medium text-ink">Kemi Okafor</span> <span className="text-muted">10:42 AM</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-body">
                  Call with Northwind just now. They moved everything off polling onto our webhooks. Delivery went from ~30s to{" "}
                  <mark className="rounded-[3px] bg-accent-soft px-0.5 text-ink">under 2s</mark>.
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-sky-deep">4 replies</p>
              </div>
            </div>
          </Panel>
          <Panel className="flex items-center gap-2.5 px-4 py-2.5">
            <GitPullRequest size={14} strokeWidth={1.75} className="shrink-0 text-[#8250df]" />
            <p className="min-w-0 truncate text-[12px] text-body">
              <span className="font-medium text-ink">#482</span> Retry webhooks with backoff
            </p>
            <Tag tone="plain">Merged</Tag>
          </Panel>
        </div>

        <div className="flex flex-col gap-3 lg:translate-y-6">
          <Step>Moment found</Step>
          <Panel className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-1.5">
              <Tag>measured</Tag>
              <Tag tone="plain">Kemi</Tag>
            </div>
            <p className="text-[14px] leading-snug font-medium text-ink">Northwind cut delivery time from 30 seconds to under 2 after moving to webhooks</p>
            <Quote source="#customers · Kemi Okafor">“Delivery went from ~30s to under 2s”</Quote>
            <div className="flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[6px] bg-accent px-2 py-1 text-[11px] font-medium text-white">LinkedIn post</span>
              <span className="inline-flex items-center gap-1 rounded-[6px] border border-line px-2 py-1 text-[11px] font-medium text-ink">
                <Building2 size={11} strokeWidth={1.75} /> Company page
              </span>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Step live>Drafting in Kemi’s voice</Step>
          <Panel>
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
              <Avatar initials="KO" tone="lime" size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-ink">Kemi Okafor</p>
                <p className="text-[11px] text-muted">Solutions engineer · Draft</p>
              </div>
              <div className="flex rounded-[6px] bg-fill p-0.5 text-[11px]">
                <span className="rounded-[4px] bg-surface px-1.5 py-0.5 font-medium text-ink shadow-sm">Hook 1</span>
                <span className="px-1.5 py-0.5 text-muted">2</span>
                <span className="px-1.5 py-0.5 text-muted">3</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 px-4 py-3 text-[13px] leading-relaxed text-ink">
              <p>Northwind stopped polling our API last month.</p>
              <p>
                Their deliveries now land in{" "}
                <span className="rounded-[3px] bg-lime/70 px-0.5">under 2 seconds instead of 30</span>. Their ops team noticed before we told
                them.
              </p>
              <p>
                What actually changed<Caret />
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              <Tag tone="lime">
                <Check size={10} strokeWidth={2.5} /> 30s to under 2s
              </Tag>
              <Tag tone="lime">
                <Check size={10} strokeWidth={2.5} /> Moved to webhooks
              </Tag>
            </div>
            <Working label="Writing · 2 claims checked" />
          </Panel>
        </div>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

const SOURCES = [
  { icon: <Hash size={12} strokeWidth={2} />, name: "#eng", text: "Go SDK 1.0 is out, zero deps outside stdlib" },
  { icon: <GitPullRequest size={12} strokeWidth={1.75} />, name: "PR #511", text: "Release go-sdk v1.0.0" },
  { icon: <Check size={12} strokeWidth={2} />, name: "WEB-214", text: "Publish Go SDK docs · Done" },
  { icon: <FileText size={12} strokeWidth={1.75} />, name: "Changelog", text: "v2.8: Go SDK, event replay" },
];

function MomentsVignette() {
  return (
    <Stage label="Four sources are read and become one moment, with its quote kept and an unsupported number removed">
      <div className="flex flex-col gap-4">
        <Panel className="divide-y divide-line">
          {SOURCES.map((source) => (
            <div key={source.name} className="flex items-center gap-2.5 px-3.5 py-2">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-fill text-ink">{source.icon}</span>
              <span className="w-[72px] shrink-0 font-mono text-[11px] text-muted">{source.name}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-body">{source.text}</span>
              <Check size={12} strokeWidth={2.5} className="shrink-0 text-lime-ink" />
            </div>
          ))}
        </Panel>
        <div className="flex justify-center text-ink/40">
          <ArrowRight size={16} strokeWidth={1.75} className="rotate-90" />
        </div>
        <Panel className="flex flex-col gap-3 p-4 md:ml-10">
          <div className="flex items-center gap-1.5">
            <Tag>shipped</Tag>
            <Tag tone="plain">Kemi</Tag>
            <span className="ml-auto text-[11px] text-muted">4 sources</span>
          </div>
          <p className="text-[15px] font-medium text-ink">Go SDK 1.0 ships with zero dependencies outside the standard library</p>
          <Quote source="#eng · Kemi Okafor">“Go SDK 1.0, written by Kemi over three weekends. Zero dependencies outside the standard library”</Quote>
          <div className="flex items-start gap-2 rounded-[8px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
            <X size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>
              Removed <span className="line-through">“10x faster integrations”</span>. No source says this.
            </span>
          </div>
        </Panel>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

function DraftVignette() {
  return (
    <Stage tone="sky" label="A draft with one claim linked to its source quote and one unsupported claim flagged for removal">
      <Panel className="relative">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
          <Avatar initials="SJ" tone="sky" size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-ink">Shola Jegede</p>
            <p className="text-[11px] text-muted">Draft · 1 claim needs a source</p>
          </div>
          <Tag tone="danger">1 flag</Tag>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink">
          <p>We renamed one setting. That was the whole change.</p>
          <p>
            “Endpoint subscription management” became “Choose which events you get”, and{" "}
            <span className="rounded-[3px] bg-lime/70 px-0.5 ring-1 ring-lime-ink/30">searches that end in no click dropped from 31% to 12%</span>.
          </p>
          <div className="rounded-[10px] border border-line bg-surface p-3 shadow-[0_16px_32px_-16px_rgb(16_16_16/0.35)] md:mx-6">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-lime-ink">
              <Check size={11} strokeWidth={2.5} /> Supported by
            </p>
            <Quote source="Changelog draft: v2.8 · Shola Jegede">“Searches that end in no click dropped from 31% to 12% in the week after the rename”</Quote>
          </div>
          <p>
            Clear labels{" "}
            <span className="underline decoration-danger decoration-wavy decoration-1 underline-offset-4">triple your documentation engagement</span>.
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2.5 md:mx-6">
            <X size={13} strokeWidth={2} className="shrink-0 text-danger" />
            <span className="min-w-0 flex-1 text-[12px] text-danger">No source says “triple”.</span>
            <span className="rounded-[6px] bg-surface px-2 py-1 text-[11px] font-medium text-ink ring-1 ring-line">Remove</span>
            <span className="rounded-[6px] bg-ink px-2 py-1 text-[11px] font-medium text-white">Rewrite</span>
          </div>
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

const WAVE = [6, 14, 9, 20, 12, 24, 16, 8, 18, 11, 22, 7, 15, 10, 19, 13, 6, 17, 9, 12];

function VoiceVignette() {
  return (
    <Stage tone="butter" label="A voice note, a tweet screenshot, and a blog link update a person's voice profile">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
        <div className="flex flex-col gap-2.5">
          <Panel className="flex items-center gap-3 px-3.5 py-3">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <Mic size={13} strokeWidth={2} />
            </span>
            <span className="otp-wave flex h-6 flex-1 items-center gap-[3px]">
              {WAVE.map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-ink/70" style={{ height: h, animationDelay: `${(i % 7) * 0.12}s` }} />
              ))}
            </span>
            <span className="font-mono text-[11px] text-muted">0:42</span>
          </Panel>
          <Panel className="flex gap-3 px-3.5 py-3">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-fill text-ink">
              <ImageIcon size={13} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted">Tweet screenshot · text found</p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink">“Shipped the Go SDK. No deps. Three weekends. Worth it.”</p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3 px-3.5 py-3">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-fill text-ink">
              <Link2 size={13} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-ink">Why our SDK has no dependencies</p>
              <p className="truncate text-[11px] text-muted">kemi.dev · Article</p>
            </div>
          </Panel>
        </div>
        <Panel>
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
            <Avatar initials="KO" tone="lime" size={28} />
            <p className="flex-1 text-[12px] font-medium text-ink">Kemi’s voice</p>
            <span className="font-mono text-[11px] text-muted">v4 · just now</span>
          </div>
          <ul className="flex flex-col gap-2 px-4 py-3 text-[12px] leading-snug text-body">
            <li className="flex gap-2">
              <span className="text-faint">·</span> Opens with the result, then the story
            </li>
            <li className="flex gap-2">
              <span className="text-faint">·</span> Short sentences. Often fragments.
            </li>
            <li className="-mx-2 flex gap-2 rounded-[6px] bg-accent-soft px-2 py-1.5 text-ink">
              <span className="text-accent-deep">+</span> Says how long it took, in weekends
              <span className="ml-auto shrink-0 text-[10px] font-medium text-accent-deep">from voice note</span>
            </li>
            <li className="flex gap-2">
              <span className="text-faint">·</span> Credits the team by first name
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
            <span className="text-[11px] text-muted">Never says</span>
            <Tag tone="danger">excited to announce</Tag>
            <Tag tone="danger">game-changer</Tag>
          </div>
        </Panel>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

const WEEK: { day: string; posts: { who: string; tone: keyof typeof AVATAR; title: string; state: "posted" | "scheduled" | "company" | "live" }[] }[] = [
  { day: "Mon 12", posts: [{ who: "SJ", tone: "sky", title: "One rename, 31% to 12%", state: "posted" }] },
  { day: "Tue 13", posts: [{ who: "TA", tone: "butter", title: "Event replay is live", state: "posted" }, { who: "R", tone: "ink", title: "v2.8 is out", state: "company" }] },
  { day: "Wed 14", posts: [{ who: "KO", tone: "lime", title: "Go SDK, no deps", state: "live" }] },
  { day: "Thu 15", posts: [{ who: "AO", tone: "accent", title: "Northwind and webhooks", state: "scheduled" }] },
  { day: "Fri 16", posts: [{ who: "R", tone: "ink", title: "Week in review", state: "company" }] },
];

function CalendarVignette() {
  return (
    <Stage label="A week of scheduled posts, with one publishing to LinkedIn right now">
      <div className="flex flex-col gap-4">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[12px] font-medium text-ink">Week of 12 Oct</p>
            <span className="text-[11px] text-muted">5 of 6 planned</span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-line [&>*]:min-w-0">
            {WEEK.map((col) => (
              <div key={col.day} className="flex min-h-[132px] flex-col gap-1.5 p-1.5 sm:p-2">
                <p className="px-0.5 text-[10px] font-medium text-muted sm:text-[11px]">{col.day}</p>
                {col.posts.map((post) => (
                  <div
                    key={post.title}
                    className={`flex flex-col gap-1 rounded-[6px] px-1.5 py-1.5 text-[10px] leading-tight sm:text-[11px] ${
                      post.state === "live"
                        ? "bg-accent-soft ring-1 ring-accent"
                        : post.state === "company"
                          ? "bg-sky/70"
                          : post.state === "posted"
                            ? "bg-fill"
                            : "border border-dashed border-ink/25"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Avatar initials={post.who} tone={post.tone} size={16} />
                      {post.state === "posted" && <Check size={10} strokeWidth={2.5} className="text-lime-ink" />}
                    </span>
                    <span className="line-clamp-2 text-ink">{post.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="md:ml-auto md:w-[78%]">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Avatar initials="KO" tone="lime" size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink">Publishing to LinkedIn</p>
              <p className="truncate text-[11px] text-muted">Shipped the Go SDK. No dependencies. Three weekends…</p>
            </div>
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-white">
              <Send size={12} strokeWidth={2} />
            </span>
          </div>
          <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
            <span className="text-[11px] text-muted">Wed 9:00 AM</span>
            <span className="relative ml-auto h-1 w-28 overflow-hidden rounded-full bg-fill">
              <span className="otp-bar absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#0a66c2]" />
            </span>
          </div>
        </Panel>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

const CLICKS = [42, 118, 96, 210, 164, 88, 61];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function RecapVignette() {
  const max = Math.max(...CLICKS);
  return (
    <Stage tone="sky" label="A weekly recap with posts, link clicks, signups, demos, a chart of clicks by day, and the top post">
      <Panel>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-medium text-ink">Recap · Week of 12 Oct</p>
          <Tag tone="plain">
            <Hash size={10} strokeWidth={2} /> sent to general
          </Tag>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            { label: "Posts", value: "11", delta: "+3" },
            { label: "Link clicks", value: "779", delta: "+41%" },
            { label: "Signups", value: "37", delta: "+12" },
            { label: "Demos booked", value: "4", delta: "+2" },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface px-4 py-3">
              <p className="text-[11px] text-muted">{stat.label}</p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[22px] tracking-[-0.02em] text-ink">{stat.value}</span>
                <span className="text-[11px] font-medium text-lime-ink">{stat.delta}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-4 pt-4 pb-3">
          <p className="mb-3 text-[11px] text-muted">Clicks by day</p>
          <div className="flex h-24 items-end gap-2">
            {CLICKS.map((value, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={`w-full rounded-t-[4px] ${i === 3 ? "bg-accent" : "bg-sky-mid"}`} style={{ height: `${(value / max) * 80}px` }} />
                <span className="text-[10px] text-muted">{DAYS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <Avatar initials="TA" tone="butter" size={24} />
          <p className="min-w-0 flex-1 truncate text-[12px] text-ink">Event replay: debug a webhook without waiting for the next one</p>
          <span className="shrink-0 text-[11px] text-muted">
            <span className="font-medium text-ink">210</span> clicks · <span className="font-medium text-ink">14</span> signups
          </span>
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------------ */

const TOUR_VIGNETTES = {
  moments: MomentsVignette,
  draft: DraftVignette,
  voice: VoiceVignette,
  calendar: CalendarVignette,
  recap: RecapVignette,
} as const;

export type VignetteName = keyof typeof TOUR_VIGNETTES;

export function Vignette({ name }: { name: VignetteName }) {
  const Component = TOUR_VIGNETTES[name];
  return <Component />;
}
