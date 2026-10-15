"use client";

import { useMutation, useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { DraftComposer, DraftList } from "@/components/draft-list";
import { SkeletonList } from "@/components/loader";
import { Button, buttonClass, Card, inputClass, Notice, PageHeader, textareaClass } from "@/components/ui";
import { VoiceStudio } from "@/components/voice-studio";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";

type Details = { about: string; audience: string; pillars: string[]; pageUrl: string };

function CompanyDetails({ details, canEdit }: { details: Details; canEdit: boolean }) {
  const { workspace } = useWorkspace();
  const save = useMutation(api.voice.setCompanyDetails);
  const [about, setAbout] = useState(details.about);
  const [audience, setAudience] = useState(details.audience);
  const [pillars, setPillars] = useState(details.pillars.join("\n"));
  const [pageUrl, setPageUrl] = useState(details.pageUrl);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const changed = about !== details.about || audience !== details.audience || pillars !== details.pillars.join("\n") || pageUrl !== details.pageUrl;

  async function submit() {
    setResult(null);
    try {
      await save({ workspaceId: workspace._id, about, audience, pillars: pillars.split("\n"), pageUrl });
      setResult({ ok: true, message: "Company details saved." });
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) });
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-medium">About {workspace.name}</h2>
          <p className="text-[13px] text-muted">Company drafts use this to choose what to stress. It is never stated as a fact.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          What the company does
          <textarea
            rows={4}
            value={about}
            disabled={!canEdit}
            onChange={(event) => setAbout(event.target.value)}
            placeholder="We build webhook infrastructure for logistics and fintech teams."
            className={textareaClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Who the page talks to
          <textarea
            rows={4}
            value={audience}
            disabled={!canEdit}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Engineering leads at companies with 50 to 500 people, and the developers who integrate with us."
            className={textareaClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Content pillars, one per line
          <textarea
            rows={4}
            value={pillars}
            disabled={!canEdit}
            onChange={(event) => setPillars(event.target.value)}
            placeholder={"Product launches\nCustomer results\nHow we build\nPeople and hiring"}
            className={textareaClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          LinkedIn company page
          <input
            value={pageUrl}
            disabled={!canEdit}
            onChange={(event) => setPageUrl(event.target.value)}
            placeholder="https://www.linkedin.com/company/your-company"
            className={inputClass}
          />
        </label>
      </div>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.message}</Notice>}
      {canEdit && (
        <Button variant="secondary" className="self-end" disabled={!changed} onClick={() => void submit()}>
          Save details
        </Button>
      )}
    </Card>
  );
}

type Tab = "posts" | "voice" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "voice", label: "Brand voice" },
  { id: "about", label: "About the company" },
];

function Stat({ label, value, hint, href }: { label: string; value: number | undefined; hint: string; href?: string }) {
  const body = (
    <>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[28px] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums">{value ?? "–"}</p>
      <p className="text-[12px] text-muted">{hint}</p>
    </>
  );
  const cls = "flex flex-col gap-2 rounded-card border border-line bg-surface/80 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-accent/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function CompanyPage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "posts") as Tab;
  const voice = useQuery(api.voice.mine, { workspaceId: workspace._id, company: true });
  const drafts = useQuery(api.drafts.list, { workspaceId: workspace._id, company: true });
  const queue = useQuery(api.drafts.reviewQueue, { workspaceId: workspace._id });
  const counts = drafts && {
    ready: drafts.filter((d) => d.status === "ready" && (!d.schedule || d.schedule.state === "failed")).length,
    scheduled: drafts.filter((d) => d.status !== "posted" && d.schedule && d.schedule.state !== "failed" && d.schedule.state !== "published").length,
    posted: drafts.filter((d) => d.status === "posted").length,
  };
  const voiceReady = voice ? voice.readyCount >= voice.minSamples : true;
  const setTab = (next: Tab) => router.replace(next === "posts" ? "/company" : `/company?tab=${next}`, { scroll: false });

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-5">
      <PageHeader
        title="Overview"
        description={`Everything for ${workspace.name}'s company page: what is waiting, what is going out, and the voice it writes in.`}
        action={
          voice?.details.pageUrl ? (
            <a href={voice.details.pageUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              Open on LinkedIn <ExternalLink size={13} strokeWidth={1.75} />
            </a>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting for review" value={queue?.length} hint="Personal and company posts" href="/review" />
        <Stat label="Ready to schedule" value={counts?.ready} hint="Approved or ready company posts" href="/calendar" />
        <Stat label="Scheduled" value={counts?.scheduled} hint="Going out on the company page" href="/calendar" />
        <Stat label="Posted" value={counts?.posted} hint="On the company page so far" />
      </div>

      {voice && !voiceReady && (
        <Notice tone="error">
          The company voice needs {voice.minSamples} sample posts before drafts sound like the brand. Add them in Brand voice.
        </Notice>
      )}

      <nav aria-label="Overview" className="flex flex-wrap gap-x-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-medium whitespace-nowrap ${
              tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "posts" && (
        <div className="flex flex-col gap-4">
          <DraftComposer company />
          <DraftList company />
        </div>
      )}
      {tab === "voice" && <VoiceStudio company />}
      {tab === "about" &&
        (voice === undefined ? (
          <SkeletonList label="Loading the company details" />
        ) : (
          <CompanyDetails key={JSON.stringify(voice.details)} details={voice.details} canEdit={voice.canEdit} />
        ))}
    </div>
  );
}
