"use client";

import { useMutation, useQuery } from "convex/react";
import { BarChart3, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { timeAgo, weekLabel } from "@/lib/format";
import { TeamOnly } from "@/components/upgrade";
import { SkeletonList } from "@/components/loader";
import { TeamTable } from "@/components/team-table";

function Stat({ label, value, previous }: { label: string; value: number; previous?: number }) {
  const delta = previous === undefined ? null : value - previous;
  return (
    <div className="flex flex-col gap-1 rounded-item border border-line bg-surface p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[28px] leading-none tracking-[-0.02em]">{value}</p>
      {delta !== null && (
        <p className={`text-[12px] ${delta > 0 ? "text-lime-ink" : delta < 0 ? "text-danger" : "text-muted"}`}>
          {delta === 0 ? "Same as last week" : `${delta > 0 ? "+" : ""}${delta} on last week`}
        </p>
      )}
    </div>
  );
}

export default function RecapPage() {
  const { workspace, features } = useWorkspace();
  const recaps = useQuery(api.recaps.list, { workspaceId: workspace._id });
  const buildNow = useMutation(api.recaps.buildNow);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const recap = recaps?.find((row) => row.weekOf === selected) ?? recaps?.[0];

  async function refresh() {
    setPending(true);
    try {
      await buildNow({ workspaceId: workspace._id });
      setSelected(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Team recap"
        description="What your team posted each week, and the clicks and signups it drove. A new recap is built every Friday."
        action={
          <Button size="md" variant="secondary" onClick={() => void refresh()} disabled={pending || !features.recap}>
            {pending ? <Spinner /> : <RefreshCw size={14} strokeWidth={1.75} />}
            Update this week
          </Button>
        }
      />
      <TeamTable />
      {!features.recap ? (
        <TeamOnly feature="recap" detail="Every Friday: what the team posted, the clicks and signups it drove, and which posts brought them." />
      ) : recaps === undefined ? (
        <SkeletonList label="Loading recaps" />
      ) : !recap ? (
        <EmptyState
          icon={<BarChart3 size={20} strokeWidth={1.75} />}
          title="No recap yet"
          body="Mark a draft as posted and track its links. Then update this week's recap."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="week" className="text-[13px] text-muted">
              Week
            </label>
            <select
              id="week"
              value={recap.weekOf}
              onChange={(event) => setSelected(event.target.value)}
              className="h-8 rounded-control border border-line bg-surface px-2 text-[13px]"
            >
              {recaps.map((row) => (
                <option key={row.weekOf} value={row.weekOf}>
                  {weekLabel(row.weekOf)}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-faint">Updated {timeAgo(recap.builtAt)}</span>
          </div>
          <p className="text-lead text-body">{recap.summary}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Posts" value={recap.stats.posts} previous={recap.stats.previous.posts} />
            <Stat label="Link clicks" value={recap.stats.clicks} previous={recap.stats.previous.clicks} />
            <Stat
              label="Signups and demos"
              value={recap.stats.conversions.signup + recap.stats.conversions.demo + recap.stats.conversions.purchase}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-[15px] font-medium">Top posts</h2>
              {recap.stats.top.length === 0 ? (
                <p className="text-[13px] text-muted">No posts this week.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {recap.stats.top.map((post, index) => (
                    <li key={`${index}-${post.url}`} className="flex gap-3">
                      <span className="font-mono text-[13px] text-accent">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[14px] font-medium hover:text-accent"
                        >
                          <span className="truncate">{post.title}</span>
                          <ExternalLink size={11} strokeWidth={1.75} />
                        </a>
                        <p className="text-[12px] text-muted">
                          {post.author}: {post.clicks} {post.clicks === 1 ? "click" : "clicks"}, {post.conversions}{" "}
                          {post.conversions === 1 ? "signup" : "signups"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-[15px] font-medium">Signups by person</h2>
              <ul className="flex flex-col gap-2">
                {recap.stats.people.map((person) => (
                  <li key={person.name} className="flex items-center gap-2 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    <span className="text-[12px] text-muted">
                      {person.posts} {person.posts === 1 ? "post" : "posts"}
                    </span>
                    <span className="w-10 text-right font-mono text-[13px]">{person.conversions ?? 0}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card className="grid gap-3 p-5 sm:grid-cols-4">
            {(
              [
                ["signup", "Signups"],
                ["demo", "Demos"],
                ["application", "Job applications"],
                ["purchase", "Purchases"],
              ] as const
            ).map(([type, label]) => (
              <div key={type}>
                <p className="text-[12px] text-muted">{label}</p>
                <p className="font-mono text-[18px]">{recap.stats.conversions[type]}</p>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
