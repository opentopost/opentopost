"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Archive, Building2, ChevronDown, ExternalLink, Milestone, PenLine, Plug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, buttonClass, Card, EmptyState, Notice, PageHeader, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";
import { isManager } from "@/lib/roles";

type Moment = FunctionReturnType<typeof api.moments.list>[number];

type ChannelId = "linkedin" | "x" | "changelog" | "investor_update" | "newsletter";

const CHANNELS: {
  id: string;
  label: string;
  channel: ChannelId;
  company?: boolean;
  manager?: boolean;
}[] = [
  { id: "linkedin", label: "LinkedIn post", channel: "linkedin" },
  {
    id: "company",
    label: "Company page",
    channel: "linkedin",
    company: true,
    manager: true,
  },
  { id: "x", label: "X post", channel: "x" },
  {
    id: "changelog",
    label: "Changelog entry",
    channel: "changelog",
    company: true,
    manager: true,
  },
  {
    id: "investor_update",
    label: "Investor update",
    channel: "investor_update",
    company: true,
    manager: true,
  },
  {
    id: "newsletter",
    label: "Newsletter",
    channel: "newsletter",
    company: true,
    manager: true,
  },
];

function MomentCard({ moment, archived }: { moment: Moment; archived: boolean }) {
  const router = useRouter();
  const draft = useMutation(api.moments.draft);
  const setArchived = useMutation(api.moments.setArchived);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manager = isManager(useWorkspace().member.role);

  async function write(channel: string) {
    setPending(channel);
    setError(null);
    try {
      const target = CHANNELS.find((row) => row.id === channel) ?? CHANNELS[0];
      const draftId = await draft({
        momentId: moment._id,
        channel: target.channel,
        company: target.company,
      });
      router.push(`/drafts/${draftId}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  const visible = CHANNELS.filter((channel) => !channel.manager || manager);
  const button = (channel: (typeof CHANNELS)[number]) => (
    <Button
      key={channel.id}
      variant={channel.id === "linkedin" ? "primary" : "secondary"}
      onClick={() => void write(channel.id)}
      disabled={Boolean(pending) || archived}
    >
      {pending === channel.id ? (
        <Spinner />
      ) : channel.id === "company" ? (
        <Building2 size={14} strokeWidth={1.75} />
      ) : (
        <PenLine size={14} strokeWidth={1.75} />
      )}
      {channel.label}
    </Button>
  );

  return (
    <Card as="article" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{moment.kind}</Badge>
        {moment.people.slice(0, 3).map((person) => (
          <Badge key={person} tone="fill">
            {person}
          </Badge>
        ))}
        <span className="ml-auto text-[12px] text-faint">{timeAgo(moment.occurredAt)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[16px] font-medium">{moment.title}</h3>
        {moment.summary.trim() !== moment.title.trim() && <p className="text-[14px] leading-relaxed text-body">{moment.summary}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-medium text-muted">Proof</p>
        <ul className="flex flex-col gap-2">
          {moment.facts.map((fact) => (
            <li key={fact.id} className="rounded-item border border-line bg-surface px-3 py-2">
              <p className="text-[13px] text-ink">{fact.text}</p>
              {fact.quote && <p className="mt-1 border-l-2 border-accent-mid pl-2 text-[12px] text-muted">&ldquo;{fact.quote}&rdquo;</p>}
              {fact.source && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-faint">
                  {fact.source.url ? (
                    <a href={fact.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                      {fact.source.title ?? "Source"}
                      <ExternalLink size={10} strokeWidth={1.75} />
                    </a>
                  ) : (
                    (fact.source.title ?? "Note")
                  )}
                  {fact.source.author && <span>by {fact.source.author}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="text-[12px] text-muted">Turn into</span>
        {visible.slice(0, 2).map(button)}
        {visible.length > 2 && (
          <details className="group relative">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-control px-2.5 text-[13px] font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              More formats
              <ChevronDown size={14} strokeWidth={1.75} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-item border border-line bg-surface p-1.5 shadow-lg">
              {visible.slice(2).map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => void write(channel.id)}
                  disabled={Boolean(pending) || archived}
                  className="flex items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-fill disabled:opacity-50"
                >
                  {pending === channel.id ? <Spinner /> : <PenLine size={14} strokeWidth={1.75} />}
                  {channel.label}
                </button>
              ))}
            </div>
          </details>
        )}
        <Button variant="ghost" className="ml-auto" onClick={() => void setArchived({ momentId: moment._id, archived: !archived })}>
          <Archive size={14} strokeWidth={1.75} />
          {archived ? "Restore" : "Archive"}
        </Button>
      </div>
      {moment.outputs > 0 && (
        <p className="text-[12px] text-muted">
          {moment.outputs} {moment.outputs === 1 ? "draft" : "drafts"} written from this moment.
        </p>
      )}
    </Card>
  );
}

export default function MomentsPage() {
  const { workspace } = useWorkspace();
  const [archived, setArchived] = useState(false);
  const moments = useQuery(api.moments.list, {
    workspaceId: workspace._id,
    archived,
  });

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Moments"
        description="True things your team did, each with the quotes that prove it. One moment can become many posts."
        action={
          <div className="flex rounded-control bg-fill p-0.5">
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setArchived(value)}
                className={`rounded-[4px] px-3 py-1 text-[13px] ${archived === value ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
              >
                {value ? "Archived" : "Active"}
              </button>
            ))}
          </div>
        }
      />
      {moments === undefined ? (
        <SkeletonList label="Loading moments" />
      ) : moments.length === 0 ? (
        <EmptyState
          icon={<Milestone size={20} strokeWidth={1.75} />}
          title={archived ? "No archived moments" : "No moments yet"}
          body="Each scan finds moments in your sources and checks every fact against an exact quote."
        >
          <Link href="/ideas" className={buttonClass("primary")}>
            Find ideas
          </Link>
          <Link href="/sources" className={buttonClass("secondary")}>
            <Plug size={14} strokeWidth={1.75} />
            Add sources
          </Link>
        </EmptyState>
      ) : (
        moments.map((moment) => <MomentCard key={moment._id} moment={moment} archived={archived} />)
      )}
    </div>
  );
}
