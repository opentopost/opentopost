"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { SkeletonList } from "@/components/loader";
import { SettingsSection } from "@/components/settings";
import { Badge, Button, fieldClass, Notice } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";
import { isManager } from "@/lib/roles";

const RETENTION = [
  { value: null, label: "Keep until deleted" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
];

const ACTOR_TONE = { member: "fill", api: "accent", slack: "lime", system: "fill" } as const;
const ACTOR_LABEL = { member: "App", api: "API", slack: "Slack", system: "Auto" } as const;

export default function SecuritySettings() {
  const { workspace, member } = useWorkspace();
  const manager = isManager(member.role);
  const log = useQuery(api.insights.auditLog, manager ? { workspaceId: workspace._id, limit: 200 } : "skip");
  const update = useMutation(api.workspaces.update);
  const [retention, setRetention] = useState<number | null>(workspace.retentionDays);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!manager) return <p className="text-[14px] text-muted">Only owners and admins can see security settings.</p>;

  async function saveRetention() {
    setMessage(null);
    try {
      await update({ workspaceId: workspace._id, retentionDays: retention });
      setMessage({ ok: true, text: "Saved. Older source items are deleted each night." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice>}
      <SettingsSection
        title="Single sign-on"
        description="Sign-in runs on Kinde. SAML and OpenID Connect single sign-on, SCIM user provisioning, MFA, and passkeys are set up in Kinde, with no change to opentopost."
      >
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-body">
          <li>In Kinde, open Organization &gt; Authentication &gt; Enterprise connections and add your identity provider (Okta, Entra ID, Google Workspace, or any SAML provider).</li>
          <li>Turn on SCIM in the same connection so people join and leave with your directory.</li>
          <li>Require MFA under Authentication &gt; Multi-factor auth.</li>
        </ol>
        <p className="text-[12px] text-muted">On the hosted version, email us and we set this up with you.</p>
      </SettingsSection>
      <SettingsSection
        title="Data retention"
        description="Raw text read from your sources (Slack messages, pull requests, tickets). Moments, drafts, and posts are kept."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={fieldClass}
            value={retention ?? ""}
            onChange={(e) => setRetention(e.target.value ? Number(e.target.value) : null)}
            aria-label="Retention"
          >
            {RETENTION.map((row) => (
              <option key={row.label} value={row.value ?? ""}>
                {row.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={retention === workspace.retentionDays} onClick={() => void saveRetention()}>
            Save
          </Button>
        </div>
        <p className="text-[12px] text-muted">Export everything or delete the workspace in Settings &gt; General.</p>
      </SettingsSection>
      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface/80 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-medium">Audit log</h2>
          <p className="text-[13px] text-muted">Who did what, from the app, Slack, the API, or autopilot. The newest 200 events.</p>
        </div>
        {log === undefined ? (
          <SkeletonList label="Loading the audit log" />
        ) : log.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-item border border-line bg-surface">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-muted">
                  <th className="px-3 py-2 font-normal">When</th>
                  <th className="px-3 py-2 font-normal">Who</th>
                  <th className="px-3 py-2 font-normal">Action</th>
                  <th className="px-3 py-2 font-normal">On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {log.map((row) => (
                  <tr key={row._id}>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {new Date(row.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Badge tone={ACTOR_TONE[row.actorType]}>{ACTOR_LABEL[row.actorType]}</Badge>
                        {row.actorName}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">{row.action}</td>
                    <td className="max-w-[320px] min-w-[220px] px-3 py-2">
                      <p className="truncate" title={row.target ?? undefined}>
                        {row.target}
                      </p>
                      {row.detail && (
                        <p className="truncate text-[11px] text-muted" title={row.detail}>
                          {row.detail}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
