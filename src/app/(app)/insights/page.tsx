"use client";

import { useMutation, useQuery } from "convex/react";
import { Copy, ExternalLink, Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SkeletonList } from "@/components/loader";
import { Badge, Button, Card, Notice, PageHeader, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { isManager } from "@/lib/roles";

function Audits() {
  const { workspace, member } = useWorkspace();
  const params = useSearchParams();
  const audits = useQuery(api.audits.list, { workspaceId: workspace._id });
  const start = useMutation(api.audits.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const manager = isManager(member.role);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await start({ workspaceId: workspace._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // /insights?audit=1 (from the homepage) starts the first audit once.
  useEffect(() => {
    if (params.get("audit") !== "1" || autoStarted.current || !audits || audits.length > 0 || !manager) return;
    autoStarted.current = true;
    const timer = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audits, params, manager]);

  const share = (token: string) => `${window.location.origin}/audit/${token}`;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[560px] flex-col gap-1">
          <h2 className="flex items-center gap-2 text-[16px] font-medium">
            <Radar size={16} strokeWidth={1.75} /> Distribution audit
          </h2>
          <p className="text-[13px] text-muted">
            The ten best stories your team has not told from the last 30 days, each with the person who should tell it. Share the page with your co-founders.
          </p>
        </div>
        {manager && (
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
            Run an audit
          </Button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {audits === undefined ? (
        <SkeletonList label="Loading audits" />
      ) : audits.length === 0 ? (
        <p className="text-[13px] text-muted">No audits yet. It reads every connected source and takes one to five minutes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
          {audits.map((row) => (
            <li key={row.token} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">{row.status === "running" ? "Reading your sources…" : row.status === "ready" ? `${row.stories} untold stories` : "No stories found"}</p>
                <p className="text-[12px] text-muted">{timeAgo(row.createdAt)}</p>
              </div>
              {row.status === "running" && <Spinner />}
              {row.status !== "running" && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(share(row.token)).then(() => setCopied(row.token));
                    }}
                  >
                    <Copy size={13} strokeWidth={1.75} />
                    {copied === row.token ? "Copied" : "Copy link"}
                  </Button>
                  <a href={`/audit/${row.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-accent underline-offset-4">
                    Open <ExternalLink size={12} strokeWidth={1.75} />
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ShippedVsTold() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const data = useQuery(api.insights.shippedVsTold, { workspaceId: workspace._id, days: 56 });
  const draft = useMutation(api.moments.draft);
  const [pending, setPending] = useState<string | null>(null);

  if (!data) return <SkeletonList label="Loading what you shipped" />;
  const share = data.shipped ? Math.round((data.told / data.shipped) * 100) : 0;
  const max = Math.max(1, ...data.weeks.map((week) => week.shipped));

  async function write(momentId: Id<"moments">) {
    setPending(momentId);
    try {
      const draftId = await draft({ momentId, channel: "linkedin" });
      router.push(`/drafts/${draftId}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-medium">Shipped vs told</h2>
        <p className="text-[13px] text-muted">Moments your team did in the last 8 weeks, and how many became a post.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Shipped", value: data.shipped },
          { label: "Told", value: data.told },
          { label: "Told share", value: `${share}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-item border border-line bg-surface p-3">
            <p className="text-[12px] text-muted">{stat.label}</p>
            <p className="text-[24px] leading-none tracking-[-0.02em] tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-ink/25" /> Shipped
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-accent" /> Told
          </span>
        </div>
        <div className="flex h-32 items-end gap-3 border-b border-line">
          {data.weeks.map((week) => (
            <div key={week.week} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]">
              <div className="w-full max-w-[18px] rounded-t-[4px] bg-ink/25" style={{ height: `${(week.shipped / max) * 100}%` }} />
              <div className="w-full max-w-[18px] rounded-t-[4px] bg-accent" style={{ height: `${(week.told / max) * 100}%` }} />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-[6px] bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">
                Week of {new Date(`${week.week}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}: {week.shipped} shipped, {week.told} told
              </div>
            </div>
          ))}
        </div>
      </div>
      {data.people.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-muted">
                <th className="py-2 font-normal">Person</th>
                <th className="py-2 font-normal">Shipped</th>
                <th className="py-2 font-normal">Told</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.people.slice(0, 10).map((person) => (
                <tr key={person.name}>
                  <td className="py-2">{person.name}</td>
                  <td className="py-2 tabular-nums">{person.shipped}</td>
                  <td className="py-2 tabular-nums">{person.told}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.untold.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">Not told yet</p>
          <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
            {data.untold.map((moment) => (
              <li key={moment.momentId} className="flex items-center gap-3 px-3 py-2">
                <Badge tone="accent">{moment.kind}</Badge>
                <p className="min-w-0 flex-1 truncate text-[13px]">{moment.title}</p>
                <Button variant="ghost" disabled={pending === moment.momentId} onClick={() => void write(moment.momentId)}>
                  {pending === moment.momentId && <Spinner />}
                  Draft it
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Pipeline() {
  const { workspace } = useWorkspace();
  const data = useQuery(api.insights.pipeline, { workspaceId: workspace._id });
  if (!data) return <SkeletonList label="Loading pipeline scores" />;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-medium">Pipeline score</h2>
        <p className="text-[13px] text-muted">
          Each idea&apos;s quality score, weighted by how your own posts about that kind of work turned into clicks and signups.
        </p>
      </div>
      {data.learning && (
        <Notice tone="ok">
          Learning from {data.totalPosts} {data.totalPosts === 1 ? "post" : "posts"}. Scores get sharper after 10 posts with tracked links.
        </Notice>
      )}
      {data.ideas.length === 0 ? (
        <p className="text-[13px] text-muted">
          No open ideas. <Link href="/ideas" className="underline decoration-accent underline-offset-4">Find ideas</Link> first.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
          {data.ideas.map((idea) => (
            <li key={idea.ideaId} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-10 font-mono text-[18px] text-accent-deep tabular-nums">{idea.pipelineScore}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">{idea.title}</p>
                <p className="text-[12px] text-muted">
                  {idea.kind} · about {idea.expectedClicks} {idea.expectedClicks === 1 ? "click" : "clicks"}, {idea.expectedConversions}{" "}
                  {idea.expectedConversions === 1 ? "signup" : "signups"} · based on {idea.basedOn}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.kinds.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "By kind of work", rows: data.kinds },
            { title: "By role", rows: data.roles },
          ].map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-[13px] font-medium">{group.title}</p>
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-[12px] text-muted">
                    <th className="py-1.5 font-normal">Kind</th>
                    <th className="py-1.5 font-normal">Posts</th>
                    <th className="py-1.5 font-normal">Clicks / post</th>
                    <th className="py-1.5 font-normal">Signups / post</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {group.rows.map((row) => (
                    <tr key={row.name}>
                      <td className="py-1.5 capitalize">{row.name}</td>
                      <td className="py-1.5 tabular-nums">{row.posts}</td>
                      <td className="py-1.5 tabular-nums">{row.clicksPerPost}</td>
                      <td className="py-1.5 tabular-nums">{row.conversionsPerPost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function InsightsPage() {
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6">
      <PageHeader title="Insights" description="What your team did, what it told the world, and what turned into pipeline." />
      <Suspense fallback={<SkeletonList label="Loading audits" />}>
        <Audits />
      </Suspense>
      <ShippedVsTold />
      <Pipeline />
    </div>
  );
}
