"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  CalendarClock,
  Check as CheckIcon,
  ChevronDown,
  Copy,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Card, inputClass, Notice, Spinner, textareaClass } from "./ui";
import { errorMessage, timeAgo } from "@/lib/format";
import { TeamOnly } from "./upgrade";

export type Draft = NonNullable<FunctionReturnType<typeof api.drafts.get>>;

export const FIX_CLAIMS = "Remove or reword every claim that has no source. Change nothing else.";

export function ClaimsPanel({ draft }: { draft: Draft }) {
  const check = useMutation(api.drafts.checkClaims);
  const revise = useMutation(api.drafts.requestRevision);
  const claims = draft.claims ?? [];
  const facts = new Map(draft.facts.map((fact) => [fact.id, fact]));
  const unsourced = claims.filter((claim) => claim.status === "unsupported").length;
  const ruleBreaks = claims.filter((claim) => claim.status === "rule").length;
  const flagged = unsourced + ruleBreaks;
  const summary = [
    unsourced ? `${unsourced} ${unsourced === 1 ? "needs" : "need"} a source` : "",
    ruleBreaks ? `${ruleBreaks} ${ruleBreaks === 1 ? "breaks" : "break"} a rule` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} strokeWidth={1.75} />
          <h2 className="text-[14px] font-medium">Claims</h2>
        </div>
        {draft.claims !== null && (
          <Badge tone={flagged ? "danger" : "lime"}>
            {flagged ? summary : "All sourced"}
          </Badge>
        )}
      </div>
      <p className="text-[12px] text-muted">
        Every fact in the post should trace back to your sources.
        {draft.claimsCheckedAt ? ` Checked ${timeAgo(draft.claimsCheckedAt)}.` : ""}
      </p>
      {claims.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {claims.map((claim, index) => (
            <li key={`${index}-${claim.text.slice(0, 20)}`}>
              <details className="group rounded-control border border-line bg-surface">
                <summary className="flex cursor-pointer items-start gap-2 px-2.5 py-2 text-[12px] leading-snug">
                  {claim.status === "supported" ? (
                    <CheckIcon size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
                  ) : (
                    <AlertTriangle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
                  )}
                  <span className="min-w-0 flex-1">{claim.text}</span>
                  <ChevronDown size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-1.5 border-t border-line px-2.5 py-2 text-[12px]">
                  {claim.note && <p className="text-danger">{claim.note}</p>}
                  {claim.factIds.map((id) => {
                    const fact = facts.get(id);
                    if (!fact) return null;
                    return (
                      <div key={id} className="flex flex-col gap-0.5">
                        <p className="text-ink">{fact.text}</p>
                        {fact.quote && <p className="border-l-2 border-accent-mid pl-2 text-muted">&ldquo;{fact.quote}&rdquo;</p>}
                        {fact.sourceUrl ? (
                          <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-faint underline">
                            {fact.sourceTitle ?? "Source"}
                          </a>
                        ) : (
                          fact.sourceTitle && <span className="text-faint">{fact.sourceTitle}</span>
                        )}
                      </div>
                    );
                  })}
                  {claim.status === "unsupported" && !claim.note && (
                    <p className="text-danger">No source supports this. Remove it or add the source.</p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {draft.isAuthor && draft.openClaims > 0 && (
        <div className="flex flex-col gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5">
          <p className="text-[12px] text-ink">
            You can&apos;t approve or schedule this draft until every claim has a source. Remove the sentence yourself, or let opentopost do it.
          </p>
          <Button
            disabled={draft.status === "generating"}
            onClick={() => void revise({ draftId: draft._id, instruction: FIX_CLAIMS, hook: draft.hook ?? draft.hooks[0] ?? "", body: draft.body })}
          >
            {draft.status === "generating" ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
            {draft.status === "generating" ? "Fixing" : "Fix it for me"}
          </Button>
        </div>
      )}
      {draft.isAuthor && (
        <Button
          variant="secondary"
          disabled={draft.checkingClaims || draft.status === "generating"}
          onClick={() => void check({ draftId: draft._id })}
        >
          {draft.checkingClaims ? <Spinner /> : <ShieldCheck size={14} strokeWidth={1.75} />}
          {draft.checkingClaims ? "Checking claims" : "Check claims again"}
        </Button>
      )}
    </Card>
  );
}

export function ReviewPanel({ draft, canReview }: { draft: Draft; canReview: boolean }) {
  const request = useMutation(api.drafts.requestReview);
  const decide = useMutation(api.drafts.decideReview);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const state = draft.reviewState;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setComment("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!draft.reviewAvailable) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-[14px] font-medium">Review</h2>
        <TeamOnly feature="review" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium">Review</h2>
        <Badge
          tone={state === "approved" ? "lime" : state === "pending" ? "accent" : state === "changes_requested" ? "danger" : "fill"}
        >
          {state === "approved"
            ? "Approved"
            : state === "pending"
              ? "Waiting"
              : state === "changes_requested"
                ? "Changes requested"
                : draft.reviewRequired
                  ? "Required"
                  : "Optional"}
        </Badge>
      </div>
      {draft.review?.decidedAt && draft.review.reviewerName && (
        <p className="text-[12px] text-muted">
          {state === "approved" ? "Approved" : "Reviewed"} by {draft.review.reviewerName} {timeAgo(draft.review.decidedAt)}.
        </p>
      )}
      {draft.review?.comment && (
        <p className="rounded-control bg-fill px-2.5 py-2 text-[13px] text-ink">{draft.review.comment}</p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {draft.isAuthor && state !== "pending" && state !== "approved" && (
        <Button
          variant={draft.reviewRequired ? "primary" : "secondary"}
          disabled={draft.status !== "ready"}
          onClick={() => void run(() => request({ draftId: draft._id }))}
        >
          {state === "changes_requested" ? "Ask for review again" : "Ask for review"}
        </Button>
      )}
      {draft.isAuthor && state === "pending" && (
        <p className="text-[12px] text-muted">An owner will review this draft. Editing it cancels the request.</p>
      )}
      {canReview && state === "pending" && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <label htmlFor="review-comment" className="text-[12px] text-muted">
            Comment (needed to request changes)
          </label>
          <textarea
            id="review-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className={textareaClass}
          />
          <div className="flex gap-2">
            <Button disabled={draft.openClaims > 0} onClick={() => void run(() => decide({ draftId: draft._id, approve: true, comment }))}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => void run(() => decide({ draftId: draft._id, approve: false, comment }))}>
              Request changes
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function LinksPanel({
  draft,
  onInsert,
}: {
  draft: Draft;
  onInsert: (original: string, short: string) => void;
}) {
  const links = useQuery(api.links.forDraft, { draftId: draft._id });
  const create = useAction(api.links.create);
  const remove = useMutation(api.links.remove);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const shortUrl = (slug: string) => `${window.location.origin}/r/${slug}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const link = await create({ draftId: draft._id, url });
      onInsert(url.trim(), shortUrl(link.slug));
      setUrl("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Link2 size={16} strokeWidth={1.75} />
        <h2 className="text-[14px] font-medium">Tracked links</h2>
      </div>
      <p className="text-[12px] text-muted">
        Track a link to count clicks and signups from this post. opentopost swaps it into the post for you.
      </p>
      {draft.isAuthor && (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="track-url" className="sr-only">
            Link to track
          </label>
          <input
            id="track-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://yourproduct.com/pricing"
            className={inputClass}
          />
          <Button type="submit" variant="secondary" disabled={pending || !url.trim()}>
            {pending ? <Spinner /> : "Track"}
          </Button>
        </form>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {links && links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link._id} className="flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px]">/r/{link.slug}</p>
                <p className="truncate text-[11px] text-muted">{link.targetUrl}</p>
              </div>
              <span className="text-right font-mono text-[11px] text-muted">
                {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
                <br />
                {link.conversions} {link.conversions === 1 ? "signup" : "signups"}
              </span>
              <Button
                variant="ghost"
                aria-label="Copy short link"
                className="w-8 px-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(shortUrl(link.slug));
                  setCopied(link._id);
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === link._id ? <CheckIcon size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
              </Button>
              {draft.isAuthor && (
                <Button variant="ghost" aria-label="Remove link" className="w-8 px-0" onClick={() => void remove({ linkId: link._id })}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function nextSlots(): number[] {
  // Tuesday, Wednesday, and Thursday mornings are the usual quiet-but-busy window on LinkedIn.
  const slots: number[] = [];
  const day = new Date();
  for (let offset = 1; offset <= 10 && slots.length < 3; offset++) {
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, 8, 30);
    if ([2, 3, 4].includes(candidate.getDay())) slots.push(candidate.getTime());
  }
  return slots;
}

function toLocalInput(time: number) {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const slotLabel = (time: number) =>
  new Date(time).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const SCHEDULE_STATE: Record<string, string> = {
  scheduled: "Scheduled",
  publishing: "Publishing now",
  published: "Published",
  due: "Due now",
  failed: "Failed",
};

export function SchedulePanel({ draft }: { draft: Draft }) {
  const schedule = useMutation(api.schedule.set);
  const cancel = useMutation(api.schedule.cancel);
  const slots = nextSlots();
  const [when, setWhen] = useState(toLocalInput(draft.schedule?.at ?? slots[0]));
  const canPublish = draft.channel === "linkedin" && draft.voice !== "company" && draft.isRealAuthor && draft.linkedinConnected;
  const [mode, setMode] = useState<"publish" | "remind">(draft.schedule?.mode ?? (canPublish ? "publish" : "remind"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = draft.schedule;
  const active = current && (current.state === "scheduled" || current.state === "publishing" || current.state === "due");

  if (!draft.isAuthor || draft.status === "posted") return null;

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await schedule({ draftId: draft._id, at: new Date(when).getTime(), mode });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex scroll-mt-8 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} strokeWidth={1.75} />
          <h2 className="text-[14px] font-medium">Schedule</h2>
        </div>
        {current && (
          <Badge tone={current.state === "failed" ? "danger" : current.state === "due" ? "accent" : "lime"}>
            {SCHEDULE_STATE[current.state]}
          </Badge>
        )}
      </div>
      {active && current ? (
        <>
          <p className="text-[13px]">
            {current.mode === "publish" ? "Publishes to your LinkedIn on " : "Reminder on "}
            <span className="font-medium">{slotLabel(current.at)}</span>
          </p>
          {current.state === "due" && (
            <p className="text-[12px] text-muted">It is time. Copy the post and publish it, then paste the link below.</p>
          )}
          {current.state !== "publishing" && (
            <Button variant="secondary" onClick={() => void cancel({ draftId: draft._id })}>
              Cancel schedule
            </Button>
          )}
        </>
      ) : (
        <>
          {current?.state === "failed" && current.error && <Notice tone="error">{current.error}</Notice>}
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setWhen(toLocalInput(slot))}
                className={`h-7 rounded-[5px] border px-2 text-[12px] ${
                  toLocalInput(slot) === when ? "border-ink bg-ink text-white" : "border-line hover:bg-fill"
                }`}
              >
                {slotLabel(slot)}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="schedule-at">
            Date and time
          </label>
          <input id="schedule-at" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className={inputClass} />
          <div className="flex flex-col gap-1.5 text-[13px]">
            <label className={`flex items-start gap-2 ${canPublish ? "" : "opacity-50"}`}>
              <input
                type="radio"
                name="mode"
                checked={mode === "publish"}
                disabled={!canPublish}
                onChange={() => setMode("publish")}
                className="mt-1 accent-[var(--color-accent)]"
              />
              <span>
                Publish to my LinkedIn
                <span className="block text-[12px] text-muted">
                  {draft.channel !== "linkedin"
                    ? "Only LinkedIn posts publish on their own."
                    : draft.voice === "company"
                    ? "LinkedIn only lets approved apps post to company pages."
                    : !draft.isRealAuthor
                      ? "Only the author can publish to their own profile."
                      : !draft.linkedinConnected
                        ? "Connect LinkedIn on the Calendar page first."
                        : "Posts on its own at that time."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === "remind"} onChange={() => setMode("remind")} className="mt-1 accent-[var(--color-accent)]" />
              <span>
                Remind me
                <span className="block text-[12px] text-muted">Shows as due in the app, and in Slack when it is connected.</span>
              </span>
            </label>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {draft.openClaims > 0 && <p className="text-[12px] text-danger">Fix the claims without a source before you schedule this draft.</p>}
          <Button onClick={() => void submit()} disabled={pending || !when || draft.openClaims > 0}>
            {pending && <Spinner />}
            {mode === "publish" ? "Schedule post" : "Set reminder"}
          </Button>
        </>
      )}
    </Card>
  );
}

const MEDIA_ACCEPT = "image/png,image/jpeg,image/gif,application/pdf,video/mp4";

/** Images, a PDF, or a video to post with the draft, or a LinkedIn post to repost. */
export function MediaPanel({ draft }: { draft: Draft }) {
  const uploadUrl = useMutation(api.media.uploadUrl);
  const attach = useMutation(api.media.attach);
  const detach = useMutation(api.media.detach);
  const setRepost = useMutation(api.media.setRepost);
  const [uploading, setUploading] = useState(false);
  const [repostUrl, setRepostUrl] = useState(draft.repostOf?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const locked = !draft.isAuthor || draft.status === "posted" || draft.schedule?.state === "scheduled";
  const media = draft.media;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadUrl({ draftId: draft._id });
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error(`Could not upload ${file.name}.`);
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        await attach({ draftId: draft._id, storageId, name: file.name });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function saveRepost(value: string | null) {
    setError(null);
    try {
      await setRepost({ draftId: draft._id, url: value });
      if (value === null) setRepostUrl("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} strokeWidth={1.75} />
        <h2 className="text-[14px] font-medium">Media and repost</h2>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      {draft.repostOf ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-muted">This draft posts as a repost. Your text shows above the original post.</p>
          <a href={draft.repostOf.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate rounded-control border border-line bg-surface px-2.5 py-2 text-[12px] text-ink hover:bg-fill">
            <Repeat2 size={13} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{draft.repostOf.url}</span>
          </a>
          {!locked && (
            <Button variant="danger" className="self-start" onClick={() => void saveRepost(null)}>
              Remove repost
            </Button>
          )}
        </div>
      ) : (
        <>
          {media.length > 0 && (
            <ul className={media[0].kind === "image" ? "grid grid-cols-3 gap-1.5" : "flex flex-col gap-1.5"}>
              {media.map((file) => (
                <li key={file.storageId} className="group relative overflow-hidden rounded-control border border-line bg-surface">
                  {file.kind === "image" && file.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex items-center gap-2 px-2.5 py-2 text-[12px]">
                      {file.kind === "video" ? <Film size={14} strokeWidth={1.75} /> : <FileText size={14} strokeWidth={1.75} />}
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="text-faint">{Math.max(1, Math.round(file.size / 1024 / 1024))} MB</span>
                    </div>
                  )}
                  {!locked && (
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => void detach({ draftId: draft._id, storageId: file.storageId })}
                      className={`${file.kind === "image" ? "absolute top-1 right-1 rounded-full bg-ink/70 p-1 text-white" : "absolute top-1.5 right-1.5 hidden rounded-full bg-danger-soft p-1 text-danger group-hover:block"}`}
                    >
                      <X size={11} strokeWidth={2} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-line px-3 py-3 text-[13px] text-muted hover:bg-fill ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              {uploading ? <Spinner /> : <Upload size={14} strokeWidth={1.75} />}
              {uploading ? "Uploading" : media.length ? "Add more" : "Add images, a PDF, or a video"}
              <input type="file" accept={MEDIA_ACCEPT} multiple className="sr-only" onChange={(event) => void upload(event.target.files)} />
            </label>
          )}
          <p className="text-[11px] text-faint">Up to 9 images, or one PDF, or one MP4 video.</p>
          {!locked && media.length === 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveRepost(repostUrl);
              }}
              className="flex flex-col gap-1.5 border-t border-line pt-3"
            >
              <label htmlFor="repost-url" className="text-[12px] font-medium">
                Or repost a LinkedIn post
              </label>
              <div className="flex gap-1.5">
                <input
                  id="repost-url"
                  value={repostUrl}
                  onChange={(event) => setRepostUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/feed/update/..."
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <Button type="submit" variant="secondary" disabled={!repostUrl.trim()}>
                  Save
                </Button>
              </div>
              <p className="text-[11px] text-faint">
                On the post, click the three dots, then Embed this post, and paste the code or link. That link always works.
              </p>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
