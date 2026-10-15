"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Cpu, Lightbulb, PenLine, PlayCircle, Send, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { GitHubLogo, LinkedInLogo, SlackLogo } from "@/components/brand-icons";
import { Mark } from "@/components/mark";
import { Badge, Button, buttonClass, Card, Notice, Spinner } from "@/components/ui";
import { tourSeen, WelcomeTour } from "@/components/welcome-tour";
import { YourWeek } from "@/components/your-week";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";
import { PROVIDER_INFO, TASKS, TASK_INFO, type Provider } from "@/lib/providers";
import { isManager } from "@/lib/roles";

type Step = {
  key: string;
  title: string;
  body: ReactNode;
  icon: ReactNode;
  done: boolean;
  optional?: boolean;
  action?: ReactNode;
};

function SetupStep({ step, current }: { step: Step; current: boolean }) {
  return (
    <li
      className={`flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-4 ${current ? "bg-accent-soft/30" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-control ${
            step.done ? "bg-accent text-white" : "border border-line bg-surface text-ink"
          }`}
        >
          {step.done ? <Check size={14} strokeWidth={2} /> : step.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-medium ${step.done ? "text-muted line-through decoration-line" : "text-ink"}`}>
            {step.title}
            {step.optional && !step.done && <span className="ml-2 font-normal text-muted">optional</span>}
          </p>
          <div className="text-[14px] text-muted">{step.body}</div>
        </div>
      </div>
      {step.action && <div className="flex shrink-0 flex-wrap gap-2 pl-11 sm:pl-0">{step.action}</div>}
    </li>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { workspace, member } = useWorkspace();
  const manager = isManager(member.role);
  const models = useQuery(api.modelConfig.forWorkspace, { workspaceId: workspace._id });
  const voice = useQuery(api.voice.mine, { workspaceId: workspace._id });
  const sources = useQuery(api.sources.overview, { workspaceId: workspace._id });
  const github = useQuery(api.github.status, { workspaceId: workspace._id });
  const slack = useQuery(api.slack.status, { workspaceId: workspace._id });
  const linkedin = useQuery(api.linkedin.status, { workspaceId: workspace._id });
  const moments = useQuery(api.moments.list, { workspaceId: workspace._id });
  const drafts = useQuery(api.drafts.list, { workspaceId: workspace._id });
  const members = useQuery(api.members.list, { workspaceId: workspace._id });
  const run = useQuery(api.ideas.latestRun, { workspaceId: workspace._id });
  const startScan = useMutation(api.ideas.startScan);
  const draftMoment = useMutation(api.moments.draft);
  const startGitHub = useAction(api.github.startInstall);
  const startSlack = useAction(api.slack.startOAuth);
  const startLinkedIn = useAction(api.linkedin.startOAuth);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    // Show the tour once, on the first visit, after the first render.
    const timer = window.setTimeout(() => setTour(!tourSeen()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const go = (key: string, start: (args: { workspaceId: typeof workspace._id }) => Promise<string>) =>
    act(key, async () => {
      window.location.href = await start({ workspaceId: workspace._id });
    });

  const provider = workspace.defaultProvider as Provider | null;
  const firstName = member.name.split(" ")[0];
  const voiceReady = (voice?.readyCount ?? 0) >= (voice?.minSamples ?? 3);
  const hasSource = Boolean(github?.connected || slack?.connected || (sources?.notes.length ?? 0) > 0);
  const scanning = run?.status === "running";
  const top = moments?.[0];
  const hasDraft = (drafts?.length ?? 0) > 0;
  const teamSize = members?.members.length ?? 1;
  const delivered = Boolean(linkedin?.connected && slack?.connected);

  const steps: Step[] = [];
  if (!workspace.modelReady) {
    steps.push({
      key: "model",
      title: "Add a model key",
      body: "Gemini has a free tier, so start there.",
      icon: <Cpu size={14} strokeWidth={1.75} />,
      done: false,
      action: manager ? (
        <Link href="/onboarding" className={buttonClass("primary")}>
          Add key
        </Link>
      ) : (
        <Badge tone="fill">Your owner adds it</Badge>
      ),
    });
  }
  steps.push({
    key: "source",
    title: "Connect where your team works",
    body: hasSource
      ? [
          github?.connected && `GitHub (${github.repos.length} ${github.repos.length === 1 ? "repo" : "repos"})`,
          slack?.connected && "Slack",
          (sources?.notes.length ?? 0) > 0 && "notes",
        ]
          .filter(Boolean)
          .join(", ") + " connected."
      : manager
        ? "Connect GitHub so opentopost can read what you shipped. No GitHub? Paste this week's notes."
        : "Your workspace owner connects GitHub, Slack or notes. Moments show up here after that.",
    icon: <GitHubLogo size={14} />,
    done: hasSource,
    action: !manager ? undefined : hasSource ? (
      <Link href="/sources" className={buttonClass("secondary")}>
        Manage
      </Link>
    ) : (
      <>
        {github?.available && (
          <Button onClick={() => go("github", startGitHub)} disabled={busy !== null}>
            {busy === "github" ? <Spinner /> : <GitHubLogo size={14} />} Connect GitHub
          </Button>
        )}
        <Link href="/sources" className={buttonClass("secondary")}>
          Paste notes
        </Link>
      </>
    ),
  });
  steps.push({
    key: "scan",
    title: "Find this week's moments",
    body: scanning
      ? "Reading your work now. This takes about a minute."
      : (moments?.length ?? 0) > 0
        ? `${moments!.length} ${moments!.length === 1 ? "moment" : "moments"} found.`
        : run?.status === "failed"
          ? (run.error ?? "The last scan failed. Try again.")
          : "opentopost picks the fixes, launches and customer wins worth a post.",
    icon: <Lightbulb size={14} strokeWidth={1.75} />,
    done: (moments?.length ?? 0) > 0,
    action:
      (moments?.length ?? 0) > 0 ? (
        <Link href="/moments" className={buttonClass("secondary")}>
          Open moments
        </Link>
      ) : (
        <Button
          onClick={() => act("scan", () => startScan({ workspaceId: workspace._id }))}
          disabled={!hasSource || !workspace.modelReady || scanning || busy !== null}
        >
          {scanning || busy === "scan" ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />} {scanning ? "Scanning" : "Find moments"}
        </Button>
      ),
  });
  steps.push({
    key: "draft",
    title: "Get your first draft",
    body: hasDraft ? (
      "Your first draft is ready. Edit it, then approve it."
    ) : top ? (
      <>
        Top moment: <span className="text-ink">{top.title}</span>
      </>
    ) : (
      "Pick a moment and opentopost writes the LinkedIn post."
    ),
    icon: <PenLine size={14} strokeWidth={1.75} />,
    done: hasDraft,
    action: hasDraft ? (
      <Link href={`/drafts/${drafts![0]._id}`} className={buttonClass("secondary")}>
        Open draft
      </Link>
    ) : top ? (
      <Button
        onClick={() =>
          act("draft", async () => {
            const id = await draftMoment({ momentId: top._id, channel: "linkedin" });
            router.push(`/drafts/${id}`);
          })
        }
        disabled={busy !== null}
      >
        {busy === "draft" ? <Spinner /> : <PenLine size={14} strokeWidth={1.75} />} Write my draft
      </Button>
    ) : undefined,
  });
  steps.push({
    key: "voice",
    title: "Make it sound like you",
    body: voiceReady ? "Your voice is saved. New drafts follow it." : "Paste three of your past posts. Drafts then copy how you write.",
    icon: <PenLine size={14} strokeWidth={1.75} />,
    done: voiceReady,
    action: (
      <Link href="/voice" className={buttonClass(voiceReady ? "secondary" : "primary")}>
        {voiceReady ? "Edit" : "Add posts"}
      </Link>
    ),
  });
  steps.push({
    key: "deliver",
    title: "Approve in Slack, post to LinkedIn",
    body: delivered
      ? "Drafts come to you in Slack and post to your LinkedIn."
      : "Drafts come to you by Slack DM, and approved posts go out on LinkedIn.",
    icon: <Send size={14} strokeWidth={1.75} />,
    done: delivered,
    optional: true,
    action: (
      <>
        {!linkedin?.connected && linkedin?.available && (
          <Button variant="secondary" onClick={() => go("linkedin", startLinkedIn)} disabled={busy !== null}>
            {busy === "linkedin" ? <Spinner /> : <LinkedInLogo size={14} />} Connect LinkedIn
          </Button>
        )}
        {!slack?.connected && slack?.available && manager && (
          <Button variant="secondary" onClick={() => go("slack", startSlack)} disabled={busy !== null}>
            {busy === "slack" ? <Spinner /> : <SlackLogo size={14} />} Connect Slack
          </Button>
        )}
      </>
    ),
  });
  if (manager) {
    steps.push({
      key: "team",
      title: "Invite your team",
      body: teamSize > 1 ? `${teamSize} people in this workspace.` : "Everyone gets drafts from their own work, in their own voice.",
      icon: <Users size={14} strokeWidth={1.75} />,
      done: teamSize > 1,
      optional: true,
      action: (
        <Link href="/settings/members" className={buttonClass(teamSize > 1 ? "secondary" : "primary")}>
          {teamSize > 1 ? "Manage" : "Invite"}
        </Link>
      ),
    });
  }
  const required = steps.filter((step) => !step.optional);
  const done = required.filter((step) => step.done).length;
  const current = steps.find((step) => !step.done)?.key;
  const setupDone = done === required.length;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-8">
      <WelcomeTour open={tour} onClose={() => setTour(false)} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-medium tracking-[-0.02em]">Welcome, {firstName}</h1>
          <p className="text-[14px] text-muted">{workspace.name}</p>
        </div>
        <Button variant="ghost" onClick={() => setTour(true)}>
          <PlayCircle size={14} strokeWidth={1.75} /> Take the tour
        </Button>
      </div>

      {(setupDone || hasDraft) && <YourWeek />}

      {setupDone ? (
        <details className="group rounded-card border border-line bg-surface/80">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-[14px] font-medium">
            Setup: {done} of {required.length} done
            <span className="text-[13px] font-normal text-muted group-open:hidden">Show</span>
          </summary>
          <ol className="border-t border-line">
            {steps.map((step) => (
              <SetupStep key={step.key} step={step} current={step.key === current} />
            ))}
          </ol>
        </details>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid-faint flex flex-col items-center gap-3 border-b border-line px-6 py-10 text-center">
            <Mark size={48} />
            <h2 className="mt-2 text-[18px] font-medium">Your first post in five minutes</h2>
            <p className="max-w-[400px] text-[14px] text-muted">
              Connect your work, find a moment, and get a draft. {done} of {required.length} done.
            </p>
            <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-fill">
              <div className="h-full bg-accent transition-all" style={{ width: `${(done / required.length) * 100}%` }} />
            </div>
          </div>
          {error && (
            <div className="border-b border-line p-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <ol>
            {steps.map((step) => (
              <SetupStep key={step.key} step={step} current={step.key === current} />
            ))}
          </ol>
        </Card>
      )}

      {provider && models && !workspace.hostedModels && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-medium tracking-[-0.01em]">Models in use</h2>
            <Link href="/settings/model" className={buttonClass("ghost")}>
              Change
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {TASKS.map((task) => {
              const row = models.find((m) => m.provider === provider && m.task === task);
              return (
                <Card key={task} as="div" className="flex flex-col gap-1 p-4">
                  <p className="text-[12px] text-muted">{TASK_INFO[task].name}</p>
                  <p className="truncate font-mono text-[13px] text-ink">{row?.modelId ?? "Not chosen"}</p>
                  <p className="text-[12px] text-muted">{PROVIDER_INFO[provider].name}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
