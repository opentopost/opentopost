"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plug, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SkeletonList } from "./loader";
import { Badge, Button, Card, inputClass, Notice, Spinner, textareaClass } from "./ui";
import { errorMessage, timeAgo } from "@/lib/format";

type Server = FunctionReturnType<typeof api.mcp.list>["servers"][number];

function AddServer({ workspaceId, onDone }: { workspaceId: Id<"workspaces">; onDone: () => void }) {
  const add = useAction(api.mcp.add);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [header, setHeader] = useState("Authorization");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const outcome = await add({ workspaceId, name, url, authHeader: header, authValue: value || undefined });
      setResult(outcome);
      if (outcome.ok) onDone();
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-item border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name, such as Linear" className={inputClass} aria-label="Server name" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://mcp.example.com/mcp" className={inputClass} aria-label="Server URL" />
        <input value={header} onChange={(event) => setHeader(event.target.value)} placeholder="Authorization" className={inputClass} aria-label="Auth header name" />
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Bearer your-token (optional)"
          autoComplete="off"
          className={inputClass}
          aria-label="Auth header value"
        />
      </div>
      <p className="text-[12px] text-muted">The auth value is encrypted before it is saved. Use a read-only token when the service offers one.</p>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.message}</Notice>}
      <Button type="submit" className="self-end" disabled={pending || name.trim().length < 2 || !url.trim()}>
        {pending && <Spinner />}
        Connect server
      </Button>
    </form>
  );
}

function Pulls({ server }: { server: Server }) {
  const setPulls = useMutation(api.mcp.setPulls);
  const [pulls, setLocal] = useState(server.pulls.length ? server.pulls : []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const readTools = server.tools.filter((tool) => tool.readOnly);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await setPulls({ serverId: server._id, pulls });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        Choose the tools each scan runs and the input each one gets. opentopost only runs tools that read, and the model never
        calls tools itself. {server.tools.length - readTools.length > 0 && `${server.tools.length - readTools.length} ${server.tools.length - readTools.length === 1 ? "tool that can change data is" : "tools that can change data are"} hidden.`}
      </p>
      {pulls.map((pull, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-item border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <select
              value={pull.tool}
              onChange={(event) => setLocal(pulls.map((row, i) => (i === index ? { ...row, tool: event.target.value } : row)))}
              className={`${inputClass} font-mono`}
              aria-label="Tool"
            >
              {readTools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
            <Button variant="ghost" aria-label="Remove tool" className="w-8 px-0" onClick={() => setLocal(pulls.filter((_, i) => i !== index))}>
              <Trash2 size={14} strokeWidth={1.75} />
            </Button>
          </div>
          <p className="text-[12px] text-muted">{readTools.find((tool) => tool.name === pull.tool)?.description ?? ""}</p>
          <textarea
            rows={2}
            value={pull.args}
            onChange={(event) => setLocal(pulls.map((row, i) => (i === index ? { ...row, args: event.target.value } : row)))}
            className={`${textareaClass} font-mono text-[12px]`}
            aria-label="Tool input as JSON"
            placeholder="{}"
          />
        </div>
      ))}
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="ok">Saved. The next scan runs these tools.</Notice>}
      <div className="flex flex-wrap gap-2">
        {readTools.length > 0 && pulls.length < 10 && (
          <Button variant="secondary" onClick={() => setLocal([...pulls, { tool: readTools[0].name, args: "{}" }])}>
            Add a tool
          </Button>
        )}
        <Button onClick={() => void save()}>Save tools</Button>
      </div>
      {readTools.length === 0 && <p className="text-[12px] text-muted">This server has no tools that only read.</p>}
    </div>
  );
}

function ServerRow({ server, canEdit }: { server: Server; canEdit: boolean }) {
  const refresh = useAction(api.mcp.refreshTools);
  const setEnabled = useMutation(api.mcp.setEnabled);
  const remove = useMutation(api.mcp.remove);
  const [open, setOpen] = useState(server.pulls.length === 0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <li className="flex flex-col gap-3 rounded-item border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[14px] font-medium">{server.name}</p>
        {server.serverName && <span className="text-[12px] text-muted">{server.serverName}</span>}
        {server.hasAuth && (
          <span className="flex items-center gap-1 text-[12px] text-muted">
            <ShieldCheck size={12} strokeWidth={1.75} />
            Auth saved
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {!server.enabled && <Badge tone="fill">Paused</Badge>}
          {server.lastError ? <Badge tone="danger">Error</Badge> : server.lastSyncedAt ? <Badge>Synced {timeAgo(server.lastSyncedAt)}</Badge> : null}
        </span>
      </div>
      <p className="truncate font-mono text-[12px] text-muted">{server.url}</p>
      {server.lastError && <Notice tone="error">{server.lastError}</Notice>}
      {message && <Notice tone={message.ok ? "ok" : "error"}>{message.message}</Notice>}
      <p className="text-[12px] text-muted">
        {server.pulls.length ? `Runs ${server.pulls.map((pull) => pull.tool).join(", ")} on each scan.` : "No tools chosen yet."}
      </p>
      {canEdit && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
              {open ? "Hide tools" : "Choose tools"}
            </Button>
            <Button
              variant="ghost"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                setMessage(await refresh({ serverId: server._id }));
                setChecking(false);
              }}
            >
              {checking ? <Spinner /> : <RefreshCw size={13} strokeWidth={1.75} />}
              Test connection
            </Button>
            <Button variant="ghost" onClick={() => void setEnabled({ serverId: server._id, enabled: !server.enabled })}>
              {server.enabled ? "Pause" : "Resume"}
            </Button>
            <Button variant="danger" onClick={() => void remove({ serverId: server._id })}>
              Remove
            </Button>
          </div>
          {open && <Pulls key={server.pulls.map((pull) => pull.tool).join()} server={server} />}
        </>
      )}
    </li>
  );
}

export function McpCard({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const data = useQuery(api.mcp.list, { workspaceId });
  const [adding, setAdding] = useState(false);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plug size={16} strokeWidth={1.75} />
          <h2 className="text-[16px] font-medium">MCP servers</h2>
        </div>
        {data && (
          <span className="font-mono text-[12px] text-muted">
            {data.servers.length}
            {data.limit !== null && ` / ${data.limit}`}
          </span>
        )}
      </div>
      <p className="text-[13px] text-muted">
        Connect any remote MCP server, such as a meeting recorder (Granola, Fireflies, or Gong), a docs search, or your own.
        Each scan runs the read tools you choose and treats what they return as source material.
      </p>
      {data === undefined ? (
        <SkeletonList label="Loading MCP servers" rows={1} compact />
      ) : (
        <>
          {data.servers.length > 0 && (
            <ul className="flex flex-col gap-3">
              {data.servers.map((server) => (
                <ServerRow key={server._id} server={server} canEdit={data.canEdit} />
              ))}
            </ul>
          )}
          {data.canEdit &&
            (adding ? (
              <AddServer workspaceId={workspaceId} onDone={() => setAdding(false)} />
            ) : (
              (data.limit === null || data.servers.length < data.limit) && (
                <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
                  Add a server
                </Button>
              )
            ))}
        </>
      )}
    </Card>
  );
}
