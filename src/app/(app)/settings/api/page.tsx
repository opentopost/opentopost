"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { SkeletonList } from "@/components/loader";
import { SecretOnce } from "@/components/secret-once";
import { SettingsSection } from "@/components/settings";
import { Toggle } from "@/components/toggle";
import { Badge, Button, inputClass, Notice, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { SITE } from "@/lib/site";

function origin() {
  return typeof window === "undefined" ? SITE.url : window.location.origin;
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-item border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink">{children}</pre>;
}

function Keys({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const { member } = useWorkspace();
  const data = useQuery(api.apiKeys.list, { workspaceId });
  const create = useAction(api.apiKeys.create);
  const revoke = useMutation(api.apiKeys.revoke);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read", "draft"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  if (!data) return <SkeletonList label="Loading keys" />;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const result = await create({ workspaceId, name: name || "Agent", scopes });
      setFresh(result.key);
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {fresh && <SecretOnce label="Copy this key now. You will not see it again." value={fresh} />}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-3 rounded-item border border-line bg-surface p-3">
        <input className={inputClass} placeholder="Key name, for example Claude Code" value={name} onChange={(e) => setName(e.target.value)} aria-label="Key name" />
        <div className="flex flex-col gap-2">
          {data.scopes.map((scope) => {
            const blocked = scope.id === "admin" && !isManager(member.role);
            return (
              <label key={scope.id} className={`flex items-start gap-2 text-[13px] ${blocked ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={blocked}
                  checked={scopes.includes(scope.id)}
                  onChange={(e) => setScopes((current) => (e.target.checked ? [...current, scope.id] : current.filter((row) => row !== scope.id)))}
                />
                <span>
                  <span className="font-medium capitalize">{scope.id}</span>
                  <span className="text-muted">: {scope.name}</span>
                </span>
              </label>
            );
          })}
        </div>
        <Button className="self-start" onClick={() => void add()} disabled={busy || scopes.length === 0}>
          {busy && <Spinner />}
          Create key
        </Button>
      </div>
      {data.keys.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
          {data.keys.map((key) => (
            <li key={key._id} className="flex flex-col gap-2 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{key.name}</p>
                  <p className="text-[12px] text-muted">
                    <span className="font-mono">{key.prefix}…</span> · acts as {key.mine ? "you" : key.owner} ·{" "}
                    {key.lastUsedAt ? `used ${timeAgo(key.lastUsedAt)}` : "never used"}
                  </p>
                </div>
                <Button variant="ghost" className="shrink-0" onClick={() => void revoke({ keyId: key._id })}>
                  Revoke
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {key.scopes.map((scope) => (
                  <Badge key={scope} tone="fill">
                    {scope}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Webhooks({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const data = useQuery(api.webhooks.list, { workspaceId });
  const create = useAction(api.webhooks.create);
  const setEnabled = useMutation(api.webhooks.setEnabled);
  const remove = useMutation(api.webhooks.remove);
  const test = useMutation(api.webhooks.test);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["draft.ready", "post.published"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  if (!data) return <SkeletonList label="Loading webhooks" />;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const result = await create({ workspaceId, url, events });
      setSecret(result.secret);
      setUrl("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {secret && <SecretOnce label="Your signing secret. Use it to check the X-Opentopost-Signature header. You will not see it again." value={secret} />}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-3 rounded-item border border-line bg-surface p-3">
        <input className={inputClass} placeholder="https://example.com/webhooks/opentopost" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Webhook address" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {data.events.map((event) => (
            <label key={event} className="flex items-center gap-2 font-mono text-[12px]">
              <input type="checkbox" checked={events.includes(event)} onChange={(e) => setEvents((current) => (e.target.checked ? [...current, event] : current.filter((row) => row !== event)))} />
              {event}
            </label>
          ))}
        </div>
        <Button className="self-start" onClick={() => void add()} disabled={busy || !url.trim() || events.length === 0}>
          {busy && <Spinner />}
          Add webhook
        </Button>
      </div>
      {data.webhooks.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
          {data.webhooks.map((hook) => (
            <li key={hook._id} className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <Toggle checked={hook.enabled} onChange={(value) => void setEnabled({ webhookId: hook._id, enabled: value })} label="Webhook on" />
                <p className="min-w-0 flex-1 basis-[160px] truncate font-mono text-[12px]" title={hook.url}>
                  {hook.url}
                </p>
                <Button variant="ghost" onClick={() => void test({ webhookId: hook._id })}>
                  Send test
                </Button>
                <Button variant="ghost" onClick={() => void remove({ webhookId: hook._id })}>
                  Delete
                </Button>
              </div>
              <p className="text-[12px] text-muted">
                {hook.events.join(", ")}
                {hook.lastAt && (
                  <>
                    {" "}· last delivery {timeAgo(hook.lastAt)}:{" "}
                    <span className={hook.lastError ? "text-danger" : "text-lime-ink"}>{hook.lastError ?? `${hook.lastStatus} OK`}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ApiSettings() {
  const { workspace, member } = useWorkspace();
  const base = origin();
  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="API keys"
        description="Agents and scripts use a key to act as you in this workspace. Choose only the permissions they need. Keys are stored as hashes."
      >
        <Keys workspaceId={workspace._id} />
      </SettingsSection>
      <SettingsSection title="Connect an agent" description="Claude, Cursor, and any MCP client can find ideas, write drafts, and schedule posts with the same tools you use.">
        <p className="text-[13px] text-muted">MCP server, with your key as a bearer token:</p>
        <Code>{`{
  "mcpServers": {
    "opentopost": {
      "type": "http",
      "url": "${base}/mcp",
      "headers": { "Authorization": "Bearer otp_..." }
    }
  }
}`}</Code>
        <p className="text-[13px] text-muted">Claude Code:</p>
        <Code>{`claude mcp add --transport http opentopost ${base}/mcp --header "Authorization: Bearer otp_..."`}</Code>
        <p className="text-[13px] text-muted">REST, the same tools as JSON endpoints:</p>
        <Code>{`curl ${base}/api/v1/list_ideas \\
  -H "Authorization: Bearer otp_..." \\
  -H "Content-Type: application/json" -d '{"limit": 5}'`}</Code>
        <p className="text-[13px] text-muted">
          <a href={`${base}/api/v1`} className="underline decoration-accent underline-offset-4" target="_blank" rel="noreferrer">
            See every tool
          </a>{" "}
          or read the <a href="/docs/agents" className="underline decoration-accent underline-offset-4">agent guide</a>.
        </p>
      </SettingsSection>
      {isManager(member.role) && (
        <SettingsSection
          title="Webhooks"
          description="opentopost sends a signed POST when ideas, drafts, posts, or conversions change. Failed deliveries retry five times."
        >
          <Webhooks workspaceId={workspace._id} />
        </SettingsSection>
      )}
    </div>
  );
}
