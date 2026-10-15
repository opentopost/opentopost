"use client";

import { useMutation, useQuery } from "convex/react";
import { CalendarClock, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { SkeletonList } from "@/components/loader";
import { Badge, Button, Card, EmptyState, Notice, Spinner, textareaClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";

const STATUS: Record<string, { label: string; tone: "lime" | "accent" | "fill" | "danger" }> = {
  generating: { label: "Writing", tone: "accent" },
  ready: { label: "Draft", tone: "fill" },
  posted: { label: "Posted", tone: "lime" },
  failed: { label: "Failed", tone: "danger" },
};

export function slotLabel(at: number) {
  return new Date(at).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PERSONAL_CHANNELS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
] as const;

const COMPANY_CHANNELS = [
  { id: "linkedin", label: "LinkedIn page" },
  { id: "changelog", label: "Changelog" },
  { id: "investor_update", label: "Investor update" },
  { id: "newsletter", label: "Newsletter" },
] as const;

export function DraftComposer({ company = false }: { company?: boolean }) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const create = useMutation(api.drafts.createFromBrief);
  const [brief, setBrief] = useState("");
  const channels = company ? COMPANY_CHANNELS : PERSONAL_CHANNELS;
  const [channel, setChannel] = useState<(typeof channels)[number]["id"]>("linkedin");
  const [showFormats, setShowFormats] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const draftId = await create({
        workspaceId: workspace._id,
        brief,
        company,
        channel,
      });
      router.push(`/drafts/${draftId}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={company ? "company-brief" : "brief"} className="text-[14px] font-medium">
          {company ? "Write a company page post" : "Write a draft from your own idea"}
        </label>
        <textarea
          id={company ? "company-brief" : "brief"}
          rows={4}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder={
            company
              ? "A launch, a customer result, a hire, or a milestone. Include names and numbers you can share."
              : "What happened, what you learned, and any numbers or names to include."
          }
          className={textareaClass}
        />
        {!showFormats ? (
          <button
            type="button"
            onClick={() => setShowFormats(true)}
            className="self-start text-[12px] text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            Write for somewhere other than LinkedIn
          </button>
        ) : (
          <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-1.5">
            {channels.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={channel === option.id}
                onClick={() => setChannel(option.id)}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  channel === option.id ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            {!workspace.modelReady
              ? "Add a model key first."
              : company
                ? "Company drafts use the company voice and go to review before posting."
                : "Drafts use your voice profile and samples."}
          </p>
          <Button type="submit" size="md" disabled={pending || !workspace.modelReady || brief.trim().length < 15}>
            {pending ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
            Write draft
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function DraftList({ company = false }: { company?: boolean }) {
  const { workspace } = useWorkspace();
  const drafts = useQuery(api.drafts.list, {
    workspaceId: workspace._id,
    company,
  });

  if (drafts === undefined) return <SkeletonList label="Loading drafts" />;
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={20} strokeWidth={1.75} />}
        title={company ? "No company posts yet" : "No drafts yet"}
        body={
          company
            ? "Write one above, or open a moment and choose Company page."
            : "Claim an idea from the Ideas page, or write a draft from your own idea above."
        }
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul>
        {drafts.map((draft) => (
          <li key={draft._id} className="border-t border-line first:border-t-0">
            <Link href={`/drafts/${draft._id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-fill/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{draft.title}</p>
                <p className="truncate text-[13px] text-muted">{draft.hook ?? "Writing in your voice"}</p>
              </div>
              {draft.schedule && draft.status !== "posted" && (
                <span className="hidden items-center gap-1 text-[12px] text-muted md:flex">
                  <CalendarClock size={13} strokeWidth={1.75} />
                  {draft.schedule.state === "failed" ? "Publishing failed" : slotLabel(draft.schedule.at)}
                </span>
              )}
              {company && draft.reviewState !== "approved" && draft.status === "ready" && <Badge tone="accent">Needs review</Badge>}
              <Badge tone={STATUS[draft.status].tone}>{STATUS[draft.status].label}</Badge>
              <span className="hidden w-24 text-right text-[12px] text-faint sm:block">{timeAgo(draft.updatedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
