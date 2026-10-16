"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Building2, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LinkedInLogo } from "@/components/brand-icons";
import { api } from "../../../../convex/_generated/api";
import { SkeletonList } from "@/components/loader";
import { Badge, Button, Card, Notice, PageHeader, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

const LINKEDIN_RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "LinkedIn is connected. Scheduled posts can now publish on their own." },
  cancelled: { ok: false, text: "LinkedIn sign-in was cancelled." },
  expired: { ok: false, text: "The LinkedIn sign-in took too long. Try again." },
  error: { ok: false, text: "LinkedIn did not finish connecting. Try again." },
};

function startOfWeek(time: number) {
  const date = new Date(time);
  const day = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day).getTime();
}

const dayLabel = (time: number) => new Date(time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
const timeLabel = (time: number) => new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const STATE_TONE: Record<string, "lime" | "accent" | "fill" | "danger"> = {
  posted: "lime",
  published: "lime",
  scheduled: "fill",
  publishing: "accent",
  due: "accent",
  failed: "danger",
};

const STATE_LABEL: Record<string, string> = {
  posted: "Posted",
  published: "Posted",
  scheduled: "Scheduled",
  publishing: "Publishing",
  due: "Due",
  failed: "Failed",
};

function LinkedInCard() {
  const { workspace } = useWorkspace();
  const status = useQuery(api.linkedin.status, { workspaceId: workspace._id });
  const start = useAction(api.linkedin.startOAuth);
  const disconnect = useMutation(api.linkedin.disconnect);
  const params = useSearchParams();
  const result = LINKEDIN_RESULTS[params.get("linkedin") ?? ""];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setPending(true);
    setError(null);
    try {
      window.location.href = await start({ workspaceId: workspace._id });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Send size={16} strokeWidth={1.75} />
        <h2 className="text-[16px] font-medium">Publish to LinkedIn</h2>
        {status?.connected && <Badge>Connected</Badge>}
      </div>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {status === undefined ? (
        <SkeletonList label="Loading LinkedIn" rows={1} compact />
      ) : !status.available ? (
        <p className="text-[13px] text-muted">
          LinkedIn publishing is not set up on this deployment, so scheduled posts send a reminder instead. The integrations guide in the
          repository explains the setup.
        </p>
      ) : status.connected ? (
        <>
          <p className="text-[13px] text-muted">
            Posting as {status.name}. LinkedIn asks you to connect again every 60 days
            {status.expiresAt ? `, next on ${new Date(status.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}.
          </p>
          <Button variant="danger" className="self-start" onClick={() => void disconnect({ workspaceId: workspace._id })}>
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {status.expired
              ? "Your LinkedIn connection expired. Connect again so scheduled posts can publish."
              : "Connect your own LinkedIn profile so scheduled posts publish on their own. opentopost can only post. It cannot read your messages or network."}
          </p>
          <Button className="self-start" onClick={() => void connect()} disabled={pending}>
            {pending ? <Spinner /> : <LinkedInLogo size={14} />}
            Connect LinkedIn
          </Button>
        </>
      )}
    </Card>
  );
}

export default function CalendarPage() {
  const { workspace } = useWorkspace();
  const [now] = useState(() => Date.now());
  const [week, setWeek] = useState(() => startOfWeek(now));
  const data = useQuery(api.schedule.range, { workspaceId: workspace._id, from: week, to: week + 7 * DAY });
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => week + index * DAY), [week]);
  const today = startOfWeek(now) === week;

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="Plan when posts go out. Posts on your own profile can publish on their own. Company posts send a reminder."
      />

      <LinkedInCard />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} strokeWidth={1.75} />
            <h2 className="text-[15px] font-medium">
              Week of {new Date(week).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!today && (
              <Button variant="ghost" onClick={() => setWeek(startOfWeek(now))}>
                This week
              </Button>
            )}
            <Button variant="ghost" aria-label="Previous week" className="w-8 px-0" onClick={() => setWeek(week - 7 * DAY)}>
              <ChevronLeft size={16} strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" aria-label="Next week" className="w-8 px-0" onClick={() => setWeek(week + 7 * DAY)}>
              <ChevronRight size={16} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        {data === undefined ? (
          <div className="p-5">
            <SkeletonList label="Loading the week" />
          </div>
        ) : (
          <div className="grid divide-y divide-line md:grid-cols-7 md:divide-x md:divide-y-0">
            {days.map((day) => {
              const items = data.items.filter((item) => item.at >= day && item.at < day + DAY);
              const isToday = now >= day && now < day + DAY;
              return (
                <div key={day} className="flex min-h-[160px] flex-col gap-2 p-3">
                  <p className={`text-[12px] font-medium ${isToday ? "text-accent" : "text-muted"}`}>{dayLabel(day)}</p>
                  {items.map((item) => (
                    <Link
                      key={`${item.kind}-${item.draftId}-${item.at}`}
                      href={item.url && item.kind === "posted" ? item.url : `/drafts/${item.draftId}`}
                      target={item.url && item.kind === "posted" ? "_blank" : undefined}
                      className={`flex flex-col gap-1 rounded-item border p-2 text-[12px] hover:bg-fill ${
                        item.state === "failed" ? "border-danger/40 bg-danger-soft/50" : "border-line bg-surface"
                      }`}
                    >
                      <span className="flex items-center gap-1 text-muted">
                        {timeLabel(item.at)}
                        {item.company && <Building2 size={11} strokeWidth={1.75} aria-label="Company page" />}
                        {item.kind === "posted" && <ExternalLink size={11} strokeWidth={1.75} />}
                      </span>
                      <span className="line-clamp-2 font-medium text-ink">{item.title}</span>
                      <span className="flex items-center justify-between gap-1">
                        <span className="truncate text-faint">{item.company ? "Company" : item.mine ? "You" : item.authorName}</span>
                        <Badge tone={STATE_TONE[item.state] ?? "fill"}>{STATE_LABEL[item.state] ?? item.state}</Badge>
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-medium">Ready to schedule</h2>
        {data === undefined ? (
          <SkeletonList label="Loading drafts" rows={2} />
        ) : data.unscheduled.length === 0 ? (
          <p className="text-[13px] text-muted">No finished drafts are waiting. Claim an idea to get one.</p>
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {data.unscheduled.map((draft) => (
                <li key={draft.draftId} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
                  {draft.company && <Building2 size={14} strokeWidth={1.75} className="text-muted" />}
                  <span className="min-w-0 flex-1 truncate text-[14px]">{draft.title}</span>
                  {draft.company && draft.needsReview && <Badge tone="accent">Needs review</Badge>}
                  <Link href={`/drafts/${draft.draftId}`} className="text-[13px] font-medium underline decoration-accent underline-offset-4">
                    Schedule
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
