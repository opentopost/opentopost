"use client";

import { isReviewer } from "@/lib/roles";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check as CheckIcon, Copy, ExternalLink, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ClaimsPanel, LinksPanel, MediaPanel, ReviewPanel, SchedulePanel, type Draft } from "@/components/draft-panels";
import { Badge, Button, Card, inputClass, Notice, Spinner, textareaClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";


const SEE_MORE_AT = 210;

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn post",
  x: "X post",
  changelog: "Changelog entry",
  investor_update: "Investor update",
  newsletter: "Newsletter section",
};

function PlainPreview({ channel, text }: { channel: string; text: string }) {
  return (
    <div className="rounded-item border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge>{CHANNEL_LABELS[channel] ?? channel}</Badge>
        {channel === "x" && (
          <span className={`text-[11px] ${text.length > 280 ? "text-red-600" : "text-muted"}`}>{text.length} / 280</span>
        )}
      </div>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

function Preview({ name, text, attachments }: { name: string; text: string; attachments?: Draft }) {
  const [expanded, setExpanded] = useState(false);
  const cut = text.length > SEE_MORE_AT && !expanded;
  return (
    <div className="rounded-item border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-sky-mid text-[12px] font-semibold">
          {name
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </span>
        <div>
          <p className="text-[13px] font-semibold">{name}</p>
          <p className="text-[11px] text-muted">Now</p>
        </div>
      </div>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
        {cut ? text.slice(0, SEE_MORE_AT).trimEnd() : text}
        {cut && (
          <>
            {"... "}
            <button type="button" onClick={() => setExpanded(true)} className="text-muted hover:underline">
              more
            </button>
          </>
        )}
      </p>
      {attachments?.repostOf && (
        <div className="mt-3 rounded-item border border-line bg-canvas px-3 py-2.5 text-[12px] text-muted">
          The original post shows here, under your text.
        </div>
      )}
      {attachments && attachments.media.length > 0 && attachments.media[0].kind === "image" && (
        <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-item ${attachments.media.length > 1 ? "grid-cols-2" : ""}`}>
          {attachments.media.slice(0, 4).map((file) =>
            file.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={file.storageId} src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
            ) : null,
          )}
        </div>
      )}
      {attachments && attachments.media.length > 0 && attachments.media[0].kind !== "image" && (
        <div className="mt-3 rounded-item border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink">
          {attachments.media[0].kind === "video" ? "Video" : "PDF"}: {attachments.media[0].name}
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
        LinkedIn shows about the first {SEE_MORE_AT} characters before &quot;more&quot;.
      </p>
    </div>
  );
}

function Editor({ draft, canReview }: { draft: Draft; canReview: boolean }) {
  const { workspace } = useWorkspace();
  const authorName = draft.voice === "company" ? workspace.name : draft.authorName;
  const router = useRouter();
  const saveEdit = useMutation(api.drafts.saveEdit);
  const requestRevision = useMutation(api.drafts.requestRevision);
  const regenerate = useMutation(api.drafts.regenerate);
  const markPosted = useMutation(api.drafts.markPosted);
  const remove = useMutation(api.drafts.remove);

  const [hook, setHook] = useState(draft.hook);
  const [body, setBody] = useState(draft.body);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [instruction, setInstruction] = useState("");
  const [postUrl, setPostUrl] = useState(draft.post?.linkedinUrl ?? "");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generating = draft.status === "generating";
  const readOnly = !draft.isAuthor;
  const blocked = draft.reviewRequired && draft.reviewState !== "approved";
  const full = [hook.trim(), body.trim()].filter(Boolean).join("\n\n");
  const isLinkedIn = draft.channel === "linkedin";
  const limit = draft.channel === "x" ? 280 : 3000;

  useEffect(() => {
    if (saveState !== "dirty") return;
    timer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await saveEdit({ draftId: draft._id, hook, body });
        setSaveState("saved");
      } catch (err) {
        setError(errorMessage(err));
        setSaveState("dirty");
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hook, body, saveState, saveEdit, draft._id]);

  const edit = (next: { hook?: string; body?: string }) => {
    if (next.hook !== undefined) setHook(next.hook);
    if (next.body !== undefined) setBody(next.body);
    setSaveState("dirty");
  };

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function copyAndOpen() {
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (isLinkedIn) window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "noopener");
  }

  async function submitRevision(event: FormEvent) {
    event.preventDefault();
    await run(() => requestRevision({ draftId: draft._id, instruction, hook, body }));
    setInstruction("");
  }

  async function submitPosted(event: FormEvent) {
    event.preventDefault();
    await run(() => markPosted({ draftId: draft._id, linkedinUrl: postUrl }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        {draft.error && <Notice tone="error">{draft.error}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium">Pick a hook</h2>
            <span className="text-[12px] text-muted">The first line people see</span>
          </div>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Hooks">
            {draft.hooks.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={hook === option}
                disabled={generating || readOnly}
                onClick={() => edit({ hook: option })}
                className={`rounded-item border px-3 py-2.5 text-left text-[14px] leading-snug transition-colors ${
                  hook === option ? "border-accent bg-accent-soft/50" : "border-line bg-surface hover:border-ink/30"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <label htmlFor="hook" className="mt-1 text-[12px] text-muted">
            Or edit the hook
          </label>
          <input
            id="hook"
            value={hook}
            disabled={generating || readOnly}
            onChange={(event) => edit({ hook: event.target.value })}
            className={inputClass}
          />
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <label htmlFor="body" className="text-[14px] font-medium">
              Post
            </label>
            <span className="text-[12px] text-muted" role="status">
              {generating
                ? "Rewriting"
                : saveState === "saved"
                  ? `Saved${draft.revisions ? `, ${draft.revisions} earlier versions` : ""}`
                  : "Saving"}
            </span>
          </div>
          <textarea
            id="body"
            rows={14}
            value={body}
            disabled={generating || readOnly}
            onChange={(event) => edit({ body: event.target.value })}
            className={`${textareaClass} min-h-[280px]`}
          />
          <p className={`text-right text-[12px] ${full.length > limit ? "text-red-600" : "text-muted"}`}>
            {full.length} / {limit.toLocaleString("en-US")} characters
          </p>
        </Card>

        {!readOnly && (
        <Card className="p-5">
          <form onSubmit={submitRevision} className="flex flex-col gap-3">
            <label htmlFor="instruction" className="text-[14px] font-medium">
              Ask for a change
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Make it shorter. Add the 40% number. End with a question."
                className={inputClass}
              />
              <Button type="submit" size="md" disabled={generating || !instruction.trim()}>
                {generating ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
                Revise
              </Button>
            </div>
          </form>
        </Card>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
        {isLinkedIn ? <Preview name={authorName} text={full} attachments={draft} /> : <PlainPreview channel={draft.channel} text={full} />}
        {isLinkedIn && <MediaPanel draft={draft} />}
        <ClaimsPanel draft={draft} />
        <ReviewPanel draft={draft} canReview={canReview} />

        <Card className="flex flex-col gap-3 p-4">
          {blocked && draft.isAuthor && (
            <p className="text-[12px] text-muted">
              {draft.voice === "company" ? "Company posts need an approved review before they go out." : "This workspace needs an approved review before you post."}
            </p>
          )}
          <Button size="md" variant="dark" onClick={() => void copyAndOpen()} disabled={generating || !full || blocked || readOnly}>
            {copied ? <CheckIcon size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
            {isLinkedIn ? (copied ? "Copied. Paste it in LinkedIn" : "Copy and open LinkedIn") : copied ? "Copied" : "Copy text"}
          </Button>
          <form onSubmit={submitPosted} className="flex flex-col gap-2 border-t border-line pt-3">
            <label htmlFor="post-url" className="text-[13px] font-medium">
              {draft.post ? "Posted" : "After you post, paste the link"}
            </label>
            <input
              id="post-url"
              value={postUrl}
              onChange={(event) => setPostUrl(event.target.value)}
              placeholder={isLinkedIn ? "https://www.linkedin.com/posts/..." : "https://..."}
              className={inputClass}
            />
            <Button type="submit" variant="secondary" disabled={!postUrl.trim() || blocked || readOnly}>
              {draft.post ? "Update link" : "Mark as posted"}
            </Button>
            {draft.post && (
              <a
                href={draft.post.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
              >
                Posted {timeAgo(draft.post.postedAt)}
                <ExternalLink size={11} strokeWidth={1.75} />
              </a>
            )}
          </form>
        </Card>

        <SchedulePanel draft={draft} />

        <LinksPanel
          draft={draft}
          onInsert={(original, short) => {
            const next = body.includes(original) ? body.split(original).join(short) : `${body.trimEnd()}\n\n${short}`;
            edit({ body: next });
          }}
        />

        {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={generating} onClick={() => void run(() => regenerate({ draftId: draft._id }))}>
            <RefreshCw size={14} strokeWidth={1.75} />
            Write a new version
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="danger"
                onClick={() =>
                  void run(async () => {
                    await remove({ draftId: draft._id });
                    router.push("/drafts");
                  })
                }
              >
                Confirm: delete draft
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </Button>
          )}
        </div>
        )}
      </aside>
    </div>
  );
}

function Writing({ draft }: { draft: Draft }) {
  return (
    <Card className="grid-faint flex flex-col items-center gap-3 px-6 py-16 text-center">
      <Spinner className="size-5 text-accent" />
      <h2 className="text-[18px] font-medium">Writing in your voice</h2>
      <p className="max-w-[420px] text-[14px] text-muted">
        {draft.idea ? draft.idea.angle : draft.brief}
      </p>
    </Card>
  );
}

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const { member } = useWorkspace();
  const draft = useQuery(api.drafts.get, { draftId: params.id as Id<"drafts"> });
  const regenerate = useMutation(api.drafts.regenerate);

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <Link
        href={draft?.voice === "company" ? "/company" : "/drafts"}
        className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        {draft?.voice === "company" ? "Overview" : "Drafts"}
      </Link>
      {draft === undefined ? (
        <SkeletonList label="Loading draft" />
      ) : draft === null ? (
        <p className="text-muted">This draft no longer exists.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-medium tracking-[-0.02em]">{draft.title}</h1>
            {draft.status === "posted" && <Badge>Posted</Badge>}
            {(draft.idea || draft.facts.length > 0) && !draft.brief && <Badge tone="fill">From a moment</Badge>}
            {!draft.isAuthor && <Badge tone="accent">By {draft.authorName}</Badge>}
          </div>
          {draft.status === "generating" && draft.hooks.length === 0 ? (
            <Writing draft={draft} />
          ) : draft.status === "failed" ? (
            <Card className="flex flex-col items-start gap-3 p-6">
              <Notice tone="error">{draft.error ?? "The draft could not be written."}</Notice>
              <Button onClick={() => void regenerate({ draftId: draft._id })}>
                <RefreshCw size={14} strokeWidth={1.75} />
                Try again
              </Button>
            </Card>
          ) : (
            <Editor key={`${draft._id}:${draft.version}`} draft={draft} canReview={isReviewer(member.role)} />
          )}
        </>
      )}
    </div>
  );
}
