"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ExternalLink, GitPullRequest, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GitHubLogo } from "./brand-icons";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SkeletonList } from "./loader";
import { Badge, Button, Card, inputClass, Notice, Spinner } from "./ui";
import { errorMessage, timeAgo } from "@/lib/format";

type Repo = { id: number; fullName: string; private: boolean };

const RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "GitHub is connected. Choose the repositories to read." },
  requested: { ok: true, text: "Your request went to a GitHub organization owner. Connect again after they approve it." },
  authorize: { ok: false, text: "GitHub did not confirm your account. Try again and approve the request." },
  error: { ok: false, text: "GitHub did not finish connecting. Try again." },
  expired: { ok: false, text: "The GitHub step took too long. Try again." },
};

function RepoPicker({ workspaceId, initial, onDone }: { workspaceId: Id<"workspaces">; initial: Repo[]; onDone: () => void }) {
  const listRepos = useAction(api.github.listRepos);
  const setRepos = useMutation(api.github.setRepos);
  const [repos, setAll] = useState<Repo[] | null>(null);
  const [chosen, setChosen] = useState(new Set(initial.map((repo) => repo.id)));
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRepos({ workspaceId })
      .then((list) => !cancelled && setAll(list))
      .catch((err) => !cancelled && setError(errorMessage(err, "The repositories did not load. Try again.")));
    return () => {
      cancelled = true;
    };
  }, [listRepos, workspaceId]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!repos) return <SkeletonList label="Loading repositories" rows={3} compact />;
  const shown = repos.filter((repo) => repo.fullName.toLowerCase().includes(filter.toLowerCase()));

  async function save() {
    setError(null);
    try {
      await setRepos({ workspaceId, repos: (repos ?? []).filter((repo) => chosen.has(repo.id)) });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {repos.length > 8 && (
        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter repositories" className={inputClass} />
      )}
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {shown.map((repo) => (
          <li key={repo.id}>
            <label className="flex items-center gap-2 rounded-control px-2 py-1.5 text-[13px] hover:bg-fill">
              <input
                type="checkbox"
                checked={chosen.has(repo.id)}
                onChange={(event) => {
                  const next = new Set(chosen);
                  if (event.target.checked) next.add(repo.id);
                  else next.delete(repo.id);
                  setChosen(next);
                }}
                className="accent-[var(--color-accent)]"
              />
              <span className="flex-1 truncate font-mono">{repo.fullName}</span>
              {repo.private && <Lock size={12} strokeWidth={1.75} className="text-muted" />}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted">{chosen.size} of 20 chosen</span>
        <Button onClick={() => void save()} disabled={chosen.size > 20}>
          Save repositories
        </Button>
      </div>
    </div>
  );
}

export function GitHubCard({ workspaceId, owner }: { workspaceId: Id<"workspaces">; owner: boolean }) {
  const status = useQuery(api.github.status, { workspaceId });
  const startInstall = useAction(api.github.startInstall);
  const disconnect = useMutation(api.github.disconnect);
  const params = useSearchParams();
  const result = RESULTS[params.get("github") ?? ""];
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setPending(true);
    setError(null);
    try {
      window.location.href = await startInstall({ workspaceId });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <GitPullRequest size={16} strokeWidth={1.75} />
        <h2 className="text-[16px] font-medium">GitHub</h2>
        {status?.connected && <Badge>Connected to {status.account}</Badge>}
      </div>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {status === undefined ? (
        <SkeletonList label="Loading GitHub" rows={1} compact />
      ) : !status.available ? (
        <p className="text-[13px] text-muted">
          GitHub is not set up on this deployment. The integrations guide in the repository explains how to create the GitHub App and set its keys.
        </p>
      ) : !status.connected ? (
        <>
          <p className="text-[13px] text-muted">
            Read merged pull requests and releases from the repositories you choose. Access is read-only, and opentopost only
            reads pull requests and release notes.
          </p>
          {owner ? (
            <Button className="self-start" onClick={() => void connect()} disabled={pending}>
              {pending ? <Spinner /> : <GitHubLogo size={14} />}
              Connect GitHub
            </Button>
          ) : (
            <p className="text-[13px] text-muted">Ask a workspace owner to connect GitHub.</p>
          )}
        </>
      ) : picking || (owner && status.repos.length === 0) ? (
        <RepoPicker workspaceId={workspaceId} initial={status.repos} onDone={() => setPicking(false)} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {status.repos.map((repo) => (
              <span key={repo.id} className="rounded-control bg-fill px-2 py-1 font-mono text-[12px]">
                {repo.fullName}
              </span>
            ))}
          </div>
          <p className="text-[12px] text-muted">
            {status.lastScannedAt ? `Read ${timeAgo(status.lastScannedAt)}. ` : ""}Each scan reads the last 14 days.
          </p>
          {owner && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPicking(true)}>
                Change repositories
              </Button>
              {status.manageUrl && (
                <a href={status.manageUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 px-2 text-[13px] text-muted hover:text-ink">
                  Manage on GitHub
                  <ExternalLink size={12} strokeWidth={1.75} />
                </a>
              )}
              <Button variant="danger" onClick={() => void disconnect({ workspaceId })}>
                Disconnect
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
