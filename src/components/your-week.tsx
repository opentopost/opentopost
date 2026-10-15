"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowRight, CalendarClock, ClipboardCheck, CornerDownLeft, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Card, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";

function Figure({ label, value, hint, accent = false }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-item border border-line bg-surface p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`text-[28px] leading-none font-medium tracking-[-0.03em] tabular-nums ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function Row({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 text-muted">{icon}</span>
        <div className="min-w-0 flex-1 text-[14px]">{children}</div>
      </div>
      {action && <div className="shrink-0 pl-7 sm:pl-0">{action}</div>}
    </li>
  );
}

/** Your week: what you shipped and posted, how posts did, and what is waiting on you. */
export function YourWeek() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const week = useQuery(api.personal.myWeek, { workspaceId: workspace._id });
  const draftMoment = useMutation(api.moments.draft);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!week) return null;

  async function write(momentId: Id<"moments">) {
    setBusy(momentId);
    setError(null);
    try {
      const id = await draftMoment({ momentId, channel: "linkedin" });
      router.push(`/drafts/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  const goalMet = week.posted >= week.goal;
  const waiting = week.waiting;
  const items =
    waiting.sentBack.length +
    waiting.ready.length +
    (week.toReview ? 1 : 0) +
    (waiting.next ? 1 : 0) +
    (waiting.inReview ? 1 : 0) +
    week.untold.length;
  const when = (at: number) => new Date(at).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[20px] font-medium tracking-[-0.01em]">Your week</h2>
        <Link href="/calendar" className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:text-ink">
          Change your goal
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Figure label="You shipped" value={week.shipped} hint="moments with your name this week" />
        <Figure
          label="You posted"
          value={`${week.posted} of ${week.goal}`}
          hint={goalMet ? "Weekly goal met" : `${week.goal - week.posted} to go this week`}
          accent={goalMet}
        />
        <Figure label="Clicks" value={week.last30.clicks} hint="from your posts, last 30 days" />
        <Figure label="Signups" value={week.last30.conversions} hint={`${week.last30.posts} posts in the last 30 days`} />
      </div>

      <Card className="overflow-hidden">
        <p className="border-b border-line px-4 py-3 text-[14px] font-medium">Waiting on you</p>
        {error && <p className="border-b border-line px-4 py-2 text-[13px] text-danger">{error}</p>}
        {items === 0 ? (
          <p className="px-4 py-5 text-[14px] text-muted">Nothing right now. New drafts come to you in Slack and show up here.</p>
        ) : (
          <ul>
            {week.toReview > 0 && (
              <Row
                icon={<ClipboardCheck size={16} strokeWidth={1.75} />}
                action={
                  <Link
                    href="/review"
                    className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-accent underline-offset-4"
                  >
                    Review <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                }
              >
                {week.toReview} {week.toReview === 1 ? "draft needs" : "drafts need"} your review
              </Row>
            )}
            {waiting.sentBack.map((draft) => (
              <Row
                key={draft._id}
                icon={<CornerDownLeft size={16} strokeWidth={1.75} />}
                action={
                  <Link
                    href={`/drafts/${draft._id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-accent underline-offset-4"
                  >
                    Fix it <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                }
              >
                <span className="font-medium">{draft.title}</span> was sent back{draft.reviewer ? ` by ${draft.reviewer}` : ""}
                {draft.comment && <span className="mt-0.5 block text-[13px] text-muted">&ldquo;{draft.comment}&rdquo;</span>}
              </Row>
            ))}
            {waiting.ready.map((draft) => (
              <Row
                key={draft._id}
                icon={<PenLine size={16} strokeWidth={1.75} />}
                action={
                  <Link
                    href={`/drafts/${draft._id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-accent underline-offset-4"
                  >
                    {draft.approved ? "Schedule" : "Review and approve"} <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                }
              >
                <span className="font-medium">{draft.title}</span> {draft.approved ? "is approved and ready to schedule" : "is ready for you"}
              </Row>
            ))}
            {waiting.inReview > 0 && (
              <Row icon={<ClipboardCheck size={16} strokeWidth={1.75} />}>
                <span className="text-muted">
                  {waiting.inReview} {waiting.inReview === 1 ? "draft is" : "drafts are"} with a reviewer. You get a Slack message when they decide.
                </span>
              </Row>
            )}
            {waiting.next && (
              <Row icon={<CalendarClock size={16} strokeWidth={1.75} />}>
                Next post: <span className="font-medium">{waiting.next.title}</span>, {when(waiting.next.at)}
                {waiting.scheduled > 1 && <span className="text-muted"> · {waiting.scheduled - 1} more scheduled</span>}
              </Row>
            )}
            {week.untold.map((moment) => (
              <Row
                key={moment.momentId}
                icon={<Sparkles size={16} strokeWidth={1.75} />}
                action={
                  <Button variant="secondary" onClick={() => void write(moment.momentId)} disabled={busy !== null}>
                    {busy === moment.momentId ? <Spinner /> : <PenLine size={14} strokeWidth={1.75} />} Write my draft
                  </Button>
                }
              >
                <span className="text-muted">Not told yet:</span> <span className="font-medium">{moment.title}</span>
              </Row>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
