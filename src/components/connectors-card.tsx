"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { BookOpen, CheckSquare, FileText, Headphones, LifeBuoy, ListChecks, RefreshCw, Rss, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CONNECTORS, CONNECTOR_KINDS, type ConnectorKind } from "../../convex/lib/connectorTypes";
import { SkeletonList } from "./loader";
import { Badge, Button, Card, inputClass, Notice, Spinner } from "./ui";
import { errorMessage, timeAgo } from "@/lib/format";

const ICONS: Record<ConnectorKind, LucideIcon> = {
  linear: ListChecks,
  jira: CheckSquare,
  notion: BookOpen,
  gdrive: FileText,
  rss: Rss,
  intercom: Headphones,
  zendesk: LifeBuoy,
};

function ConnectForm({
  workspaceId,
  kind,
  driveReader,
  onDone,
}: {
  workspaceId: Id<"workspaces">;
  kind: ConnectorKind;
  driveReader: string | null;
  onDone: () => void;
}) {
  const info = CONNECTORS[kind];
  const add = useAction(api.connectors.add);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(info.fields.map((field) => [field.key, field.options?.[0].value ?? ""])),
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const outcome = await add({ workspaceId, kind, values });
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
      <p className="text-[13px] text-muted">{info.help}</p>
      {kind === "gdrive" && driveReader && (
        <p className="rounded-control bg-fill px-3 py-2 font-mono text-[12px] break-all">{driveReader}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {info.fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-[13px] font-medium">
            {field.label}
            {field.options ? (
              <select
                value={values[field.key]}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                className={inputClass}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                value={values[field.key]}
                placeholder={field.placeholder}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                className={inputClass}
              />
            )}
          </label>
        ))}
      </div>
      {info.fields.some((field) => field.secret) && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <ShieldCheck size={12} strokeWidth={1.75} />
          Keys are checked with the service, then encrypted before they are saved.
        </p>
      )}
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.message}</Notice>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Connect {info.name}
        </Button>
      </div>
    </form>
  );
}

export function ConnectorsCard({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const data = useQuery(api.connectors.list, { workspaceId });
  const syncNow = useAction(api.connectors.syncNow);
  const setEnabled = useMutation(api.connectors.setEnabled);
  const remove = useMutation(api.connectors.remove);
  const [adding, setAdding] = useState<ConnectorKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { ok: boolean; message: string }>>({});

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[16px] font-medium">More sources</h2>
        <p className="text-[13px] text-muted">
          Read-only connections an owner chooses. Each scan reads the last 14 days. The model only reads what these return. It
          cannot call them.
        </p>
      </div>
      {data === undefined ? (
        <SkeletonList label="Loading sources" rows={2} compact />
      ) : (
        <>
          {data.connected.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.connected.map((source) => {
                const info = CONNECTORS[source.kind];
                const Icon = ICONS[source.kind];
                const detail = Object.values(source.settings).filter(Boolean).join(" · ");
                const message = messages[source._id];
                return (
                  <li key={source._id} className="flex flex-col gap-2 rounded-item border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon size={15} strokeWidth={1.75} />
                      <span className="text-[14px] font-medium">{info.name}</span>
                      {detail && <span className="min-w-0 truncate font-mono text-[12px] text-muted">{detail}</span>}
                      <span className="ml-auto flex items-center gap-2">
                        {info.anonymised && <Badge tone="fill">Anonymised</Badge>}
                        {!source.enabled && <Badge tone="fill">Paused</Badge>}
                        {source.lastError ? (
                          <Badge tone="danger">Error</Badge>
                        ) : source.lastSyncedAt ? (
                          <Badge>Read {timeAgo(source.lastSyncedAt)}</Badge>
                        ) : null}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted">{info.reads}</p>
                    {source.lastError && <Notice tone="error">{source.lastError}</Notice>}
                    {message && <Notice tone={message.ok ? "ok" : "error"}>{message.message}</Notice>}
                    {data.canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={busy === source._id}
                          onClick={async () => {
                            setBusy(source._id);
                            const outcome = await syncNow({ sourceId: source._id });
                            setMessages({ ...messages, [source._id]: outcome });
                            setBusy(null);
                          }}
                        >
                          {busy === source._id ? <Spinner /> : <RefreshCw size={13} strokeWidth={1.75} />}
                          Read now
                        </Button>
                        <Button variant="ghost" onClick={() => void setEnabled({ sourceId: source._id, enabled: !source.enabled })}>
                          {source.enabled ? "Pause" : "Resume"}
                        </Button>
                        <Button variant="danger" onClick={() => void remove({ sourceId: source._id })}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {data.canEdit &&
            (adding ? (
              <ConnectForm workspaceId={workspaceId} kind={adding} driveReader={data.driveReader} onDone={() => setAdding(null)} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CONNECTOR_KINDS.filter((kind) => kind !== "gdrive" || data.driveReader).map((kind) => {
                  const Icon = ICONS[kind];
                  const info = CONNECTORS[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setAdding(kind)}
                      className="flex flex-col items-start gap-1.5 rounded-item border border-line bg-surface/60 p-3 text-left hover:bg-surface"
                    >
                      <span className="flex items-center gap-2 text-[14px] font-medium">
                        <Icon size={15} strokeWidth={1.75} />
                        {info.name}
                      </span>
                      <span className="text-[12px] text-muted">{info.reads}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          {!data.canEdit && data.connected.length === 0 && <p className="text-[13px] text-muted">Ask a workspace owner to connect more sources.</p>}
        </>
      )}
    </Card>
  );
}
