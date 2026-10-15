"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { SkeletonList } from "@/components/loader";
import { SettingsSection } from "@/components/settings";
import { Button, inputClass, Notice, Spinner } from "@/components/ui";
import { TeamOnly } from "@/components/upgrade";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { isManager } from "@/lib/roles";

const PROVIDERS = [
  {
    id: "hubspot" as const,
    name: "HubSpot",
    help: "Create a private app in HubSpot (Settings > Integrations > Private apps) with the crm.objects.contacts.read scope, then paste its token. New contacts who arrived from a post count as signups. Contacts that reach Sales Qualified Lead or Opportunity count as demos.",
  },
  {
    id: "attio" as const,
    name: "Attio",
    help: "Create an API key in Attio (Workspace settings > Developers) with read access to records. Store the visitor's utm_content in a People attribute, and give its slug below. Each new person with a value counts as a signup.",
  },
];

export default function PipelineSettings() {
  const { workspace, member, features } = useWorkspace();
  const rows = useQuery(api.crm.list, isManager(member.role) ? { workspaceId: workspace._id } : "skip");
  const connect = useAction(api.crm.connect);
  const disconnect = useMutation(api.crm.disconnect);
  const syncNow = useMutation(api.crm.syncNow);
  const [provider, setProvider] = useState<"hubspot" | "attio">("hubspot");
  const [token, setToken] = useState("");
  const [attribute, setAttribute] = useState("utm_content");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isManager(member.role)) return <p className="text-[14px] text-muted">Only owners and admins can connect a CRM.</p>;
  if (!features.conversions) return <TeamOnly feature="conversions" detail="Count signups and demos from HubSpot or Attio." />;
  if (rows === undefined) return <SkeletonList label="Loading connections" />;

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      await connect({ workspaceId: workspace._id, provider, token, attribute: provider === "attio" ? attribute : undefined });
      setToken("");
      setMessage({ ok: true, text: "Connected. The first sync looks back 30 days." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const current = PROVIDERS.find((row) => row.id === provider)!;
  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice>}
      <SettingsSection
        title="Signups and demos from your CRM"
        description="Every tracked link adds utm_content to the visit. opentopost reads it back from your CRM each hour and credits the post. No code on your site."
      >
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-item border border-line bg-surface">
            {rows.map((row) => (
              <li key={row._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{row.provider === "hubspot" ? "HubSpot" : "Attio"}</p>
                  <p className="text-[12px] text-muted">
                    Token ending {row.last4} · {row.imported} imported ·{" "}
                    {row.lastError ? <span className="text-danger">{row.lastError}</span> : row.lastSyncedAt ? `synced ${timeAgo(row.lastSyncedAt)}` : "first sync running"}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => void syncNow({ workspaceId: workspace._id })}>
                  Sync now
                </Button>
                <Button variant="danger" onClick={() => void disconnect({ connectionId: row._id })}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3 rounded-item border border-line bg-surface p-3">
          <div className="flex gap-1 rounded-[8px] bg-fill p-0.5 self-start">
            {PROVIDERS.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setProvider(row.id)}
                className={`rounded-[6px] px-3 py-1 text-[13px] ${provider === row.id ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
              >
                {row.name}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted">{current.help}</p>
          <input className={inputClass} type="password" placeholder={`${current.name} token`} value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token" />
          {provider === "attio" && (
            <input className={inputClass} placeholder="Attribute slug, for example utm_content" value={attribute} onChange={(e) => setAttribute(e.target.value)} aria-label="Attribute slug" />
          )}
          <Button className="self-start" onClick={() => void add()} disabled={busy || token.trim().length < 10}>
            {busy && <Spinner />}
            Connect {current.name}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title="Other CRMs and your own app" description="Send conversions from anywhere with the conversion API. The key is in Settings > General.">
        <p className="text-[13px] text-muted">
          POST to <span className="font-mono">/api/conversions</span> with your conversion key, the visitor&apos;s utm_content, and the type: signup, demo,
          application, or purchase.
        </p>
      </SettingsSection>
    </div>
  );
}
