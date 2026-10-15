"use client";

import { useMutation, useQuery } from "convex/react";
import { Building2, ChevronDown, ExternalLink, FileText, Lightbulb, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Badge, Button, buttonClass, Card, EmptyState, Notice, PageHeader, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo, weekLabel } from "@/lib/format";
import { SkeletonList } from "@/components/loader";

type Idea = FunctionReturnType<typeof api.ideas.list>["ideas"][number];

const SCORE_LABELS: { key: "novelty" | "proof" | "audienceFit" | "timeliness"; label: string }[] = [
  { key: "novelty", label: "Fresh" },
  { key: "proof", label: "Proof" },
  { key: "audienceFit", label: "Audience" },
  { key: "timeliness", label: "Timely" },
];

function IdeaCard({ idea }: { idea: Idea }) {
  const router = useRouter();
  const claim = useMutation(api.ideas.claim);
  const setDismissed = useMutation(api.ideas.setDismissed);
  const [pending, setPending] = useState<"me" | "company" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dismissed = idea.status === "dismissed";

  async function onClaim(target: "me" | "company") {
    setPending(target);
    setError(null);
    try {
      const draftId = await claim({ ideaId: idea._id, company: target === "company" });
      router.push(`/drafts/${draftId}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  return (
    <Card as="article" className={`flex flex-col gap-4 p-5 ${dismissed ? "opacity-60" : ""}`}>
      <div className="flex gap-4">
        <div className="flex w-12 shrink-0 flex-col items-start">
          <span className="font-mono text-[22px] leading-none text-accent">{idea.score}</span>
          <span className="mt-1 text-[11px] text-muted">score</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[16px] font-medium text-ink">{idea.title}</h3>
          <p className="text-[14px] leading-relaxed text-body">{idea.angle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {idea.claimedBy ? (
              <Badge tone={idea.claimedByMe ? "accent" : "fill"}>
                {idea.status === "posted" ? "Posted by" : "Claimed by"} {idea.claimedByMe ? "you" : idea.claimedBy}
              </Badge>
            ) : idea.suggested ? (
              <Badge tone="fill">For {idea.suggestedIsMe ? "you" : idea.suggested}</Badge>
            ) : null}
            {idea.sources.map((source) =>
              source.url ? (
                <a
                  key={source._id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-5 max-w-[220px] items-center gap-1 rounded-[4px] border border-line px-1.5 text-[12px] text-body hover:text-ink"
                >
                  <ExternalLink size={11} strokeWidth={1.75} />
                  <span className="truncate">{source.title ?? "Source"}</span>
                </a>
              ) : (
                <span
                  key={source._id}
                  title={source.snippet}
                  className="inline-flex h-5 max-w-[220px] items-center gap-1 rounded-[4px] border border-line px-1.5 text-[12px] text-body"
                >
                  <FileText size={11} strokeWidth={1.75} />
                  <span className="truncate">{source.title ?? source.snippet}</span>
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <details className="group rounded-item bg-fill/60">
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[12px] font-medium text-body">
          {idea.facts.length ? `Proof and score (${idea.facts.length} ${idea.facts.length === 1 ? "fact" : "facts"})` : "Why this score"}
          <ChevronDown size={14} strokeWidth={1.75} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3">
          {idea.facts.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {idea.facts.map((fact) => (
                <li key={fact.id} className="rounded-control bg-surface px-2.5 py-2">
                  <p className="text-[13px] text-ink">{fact.text}</p>
                  {fact.quote && <p className="mt-0.5 border-l-2 border-accent-mid pl-2 text-[12px] text-muted">&ldquo;{fact.quote}&rdquo;</p>}
                </li>
              ))}
            </ul>
          )}
          {idea.scores && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SCORE_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-control bg-surface px-2 py-1.5">
                  <p className="text-[11px] text-muted">{label}</p>
                  <p className="font-mono text-[13px]">{idea.scores![key]}/10</p>
                </div>
              ))}
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {idea.reasons.map((reason) => (
              <li key={reason} className="text-[13px] text-body">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {idea.draftId ? (
          <Link href={`/drafts/${idea.draftId}`} className={buttonClass("secondary")}>
            Open draft
          </Link>
        ) : !idea.claimedBy && !dismissed ? (
          <>
            <Button onClick={() => void onClaim("me")} disabled={Boolean(pending)}>
              {pending === "me" ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
              Claim and draft
            </Button>
            <Button variant="secondary" onClick={() => void onClaim("company")} disabled={Boolean(pending)}>
              {pending === "company" ? <Spinner /> : <Building2 size={14} strokeWidth={1.75} />}
              Company page
            </Button>
          </>
        ) : null}
        {!idea.claimedBy && (
          <Button
            variant="ghost"
            onClick={() => void setDismissed({ ideaId: idea._id, dismissed: !dismissed })}
          >
            {dismissed ? "Restore" : "Dismiss"}
          </Button>
        )}
        <span className="ml-auto text-[12px] text-faint">{timeAgo(idea.createdAt)}</span>
      </div>
    </Card>
  );
}

function ScanStatus({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const run = useQuery(api.ideas.latestRun, { workspaceId });
  if (!run) return null;
  if (run.status === "running") {
    return (
      <p className="flex items-center gap-2 rounded-item bg-accent-soft px-3 py-2 text-[14px] text-ink" role="status">
        <Spinner className="text-accent" />
        Reading your sources and scoring ideas. This takes about a minute.
      </p>
    );
  }
  if (run.status === "failed") return <Notice tone="error">{run.error ?? "The last scan failed."}</Notice>;
  return (
    <p className="text-[13px] text-muted" role="status">
      Last scan {timeAgo(run.startedAt)}. {run.message}
    </p>
  );
}

export default function IdeasPage() {
  const { workspace } = useWorkspace();
  const [showDismissed, setShowDismissed] = useState(false);
  const data = useQuery(api.ideas.list, { workspaceId: workspace._id, showDismissed });
  const run = useQuery(api.ideas.latestRun, { workspaceId: workspace._id });
  const startScan = useMutation(api.ideas.startScan);
  const [error, setError] = useState<string | null>(null);
  const running = run?.status === "running";

  async function onScan() {
    setError(null);
    try {
      await startScan({ workspaceId: workspace._id });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const groups = new Map<string, Idea[]>();
  for (const idea of data?.ideas ?? []) {
    groups.set(idea.weekOf, [...(groups.get(idea.weekOf) ?? []), idea]);
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Ideas"
        description="Post ideas from the last 14 days of your sources. Claim one to get a draft in your voice."
        action={
          <Button size="md" onClick={onScan} disabled={running || !workspace.modelReady}>
            {running ? <Spinner /> : <Lightbulb size={14} strokeWidth={1.75} />}
            {running ? "Finding ideas" : "Find ideas"}
          </Button>
        }
      />
      {!workspace.modelReady && (
        <Notice tone="error">Add a model key in model settings before you find ideas.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <ScanStatus workspaceId={workspace._id} />

      {data === undefined ? (
        <SkeletonList label="Loading ideas" />
      ) : data.ideas.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={20} strokeWidth={1.75} />}
          title="No ideas yet"
          body="Add a few notes from this week, such as meeting notes, a changelog, or a customer call. Then click Find ideas."
        >
          <Link href="/sources" className={buttonClass("secondary")}>
            <Plug size={14} strokeWidth={1.75} />
            Add notes
          </Link>
        </EmptyState>
      ) : (
        [...groups.entries()].map(([week, ideas]) => (
          <section key={week} className="flex flex-col gap-3">
            <h2 className="mt-4 text-[14px] font-medium text-muted">{weekLabel(week)}</h2>
            {ideas.map((idea) => (
              <IdeaCard key={idea._id} idea={idea} />
            ))}
          </section>
        ))
      )}

      {data && data.dismissed > 0 && (
        <button
          type="button"
          onClick={() => setShowDismissed((value) => !value)}
          className="self-start text-[13px] text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          {showDismissed ? "Hide dismissed ideas" : `Show ${data.dismissed} dismissed`}
        </button>
      )}
    </div>
  );
}
