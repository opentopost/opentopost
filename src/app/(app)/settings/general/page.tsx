"use client";

import { isManager } from "@/lib/roles";
import { useAction, useMutation, useQuery, useConvex } from "convex/react";
import Link from "next/link";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { SettingsSection } from "@/components/settings";
import { Badge, Button, inputClass, Notice, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";
import { TeamOnly } from "@/components/upgrade";
import { SkeletonList } from "@/components/loader";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Usage({ label, used, cap }: { label: string; used: number; cap: number | null }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-item border border-line bg-surface p-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="font-mono text-[14px]">
        {used}
        <span className="text-faint"> / {cap ?? "No limit"}</span>
      </p>
      {cap !== null && (
        <div className="h-1 overflow-hidden rounded-full bg-fill">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

const PLAN_LABEL = { free: "Free", pro: "Pro", team: "Team" } as const;

export default function GeneralSettings() {
  const router = useRouter();
  const convex = useConvex();
  const { workspace, member, mode, limits, features, plan } = useWorkspace();
  const usage = useQuery(api.workspaces.usage, { workspaceId: workspace._id });
  const update = useMutation(api.workspaces.update);
  const deleteWorkspace = useMutation(api.account.deleteWorkspace);
  const conversionKey = useQuery(api.links.conversionKey, isManager(member.role) ? { workspaceId: workspace._id } : "skip");
  const rotateKey = useAction(api.links.rotateConversionKey);
  const owner = member.role === "owner";

  const [name, setName] = useState(workspace.name);
  const [scanDay, setScanDay] = useState(workspace.scanDay);
  const [timezone, setTimezone] = useState(workspace.timezone);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const changed = name !== workspace.name || scanDay !== workspace.scanDay || timezone !== workspace.timezone;

  async function save() {
    setMessage(null);
    try {
      await update({ workspaceId: workspace._id, name, scanDay, timezone });
      setMessage({ ok: true, text: "Workspace saved." });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await convex.query(api.account.exportWorkspace, { workspaceId: workspace._id });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `opentopost-${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteWorkspace({ workspaceId: workspace._id, confirmName: confirm });
      router.push("/dashboard");
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection title="Workspace" description="The name everyone in this workspace sees.">
        <label htmlFor="ws-name" className="text-[13px] font-medium">
          Name
        </label>
        <input id="ws-name" value={name} disabled={!owner} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scan-day" className="text-[13px] font-medium">
              Weekly scan day
            </label>
            <select
              id="scan-day"
              value={scanDay}
              disabled={!owner}
              onChange={(e) => setScanDay(Number(e.target.value))}
              className={inputClass}
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-[13px] font-medium">
              Time zone
            </label>
            <select
              id="timezone"
              value={timezone}
              disabled={!owner}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClass}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[12px] text-muted">The weekly scan runs at 07:00 UTC on the day you choose.</p>
        {message && <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice>}
        {owner ? (
          <Button className="self-end" disabled={!changed} onClick={() => void save()}>
            Save changes
          </Button>
        ) : (
          <p className="text-[13px] text-muted">Only owners can change workspace settings.</p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Review"
        description="When review is required, an owner approves each draft before anyone can copy it to LinkedIn."
      >
        {!features.review ? (
          <TeamOnly feature="review" />
        ) : (
        <label className="flex items-start gap-3 text-[14px]">
          <input
            type="checkbox"
            checked={workspace.reviewRequired}
            disabled={!owner}
            onChange={(e) => void update({ workspaceId: workspace._id, reviewRequired: e.target.checked })}
            className="mt-1 accent-[var(--color-accent)]"
          />
          <span>
            Require review before posting
            <span className="block text-[12px] text-muted">
              Anyone can still ask for review when this is off.
            </span>
          </span>
        </label>
        )}
      </SettingsSection>

      {owner && (
        <SettingsSection
          title="Conversion tracking"
          description="Send signups, demos, and job applications from your own site, so the weekly recap shows outcomes, not likes."
        >
          {!features.conversions ? (
            <TeamOnly feature="conversions" />
          ) : conversionKey ? (
            <>
              <p className="text-[13px]">Workspace key</p>
              <code className="block truncate rounded-control bg-fill px-3 py-2 font-mono text-[12px]">{conversionKey}</code>
              <p className="text-[13px]">Add this to your site. It reads the tracked link from the landing URL and reports a signup.</p>
              <pre className="overflow-x-auto rounded-control bg-ink p-3 font-mono text-[11px] leading-relaxed text-white">{`<script>
  const ref = new URLSearchParams(location.search).get("utm_content");
  if (ref) localStorage.setItem("opentopost_ref", ref);
  window.opentopostConvert = (type) =>
    fetch("${typeof window === "undefined" ? "" : window.location.origin}/api/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "${conversionKey}",
        ref: localStorage.getItem("opentopost_ref"),
        type, // "signup", "demo", "application", or "purchase"
      }),
    });
</script>`}</pre>
              <p className="text-[12px] text-muted">Call opentopostConvert(&quot;signup&quot;) after someone signs up.</p>
              <Button variant="ghost" className="self-start" onClick={() => void rotateKey({ workspaceId: workspace._id })}>
                Replace key
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="self-start" onClick={() => void rotateKey({ workspaceId: workspace._id })}>
              Create a workspace key
            </Button>
          )}
        </SettingsSection>
      )}

      <SettingsSection
        title="Plan"
        description={
          mode === "hosted"
            ? "What this workspace can use. Change the plan in Billing."
            : "This is a self-hosted copy. It has no limits."
        }
      >
        <div className="flex items-center gap-2">
          <Badge>{mode === "hosted" ? PLAN_LABEL[plan] : "Self-hosted"}</Badge>
          {mode === "hosted" && (
            <Link href="/settings/billing" className="text-[13px] font-medium underline decoration-accent underline-offset-4">
              Billing
            </Link>
          )}
        </div>
        {usage ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Usage label="Members" used={usage.members} cap={limits.membersPerWorkspace} />
            <Usage label="Sources" used={usage.sources} cap={limits.sources} />
            <Usage label="MCP servers" used={usage.mcpServers} cap={limits.mcpServers} />
          </div>
        ) : (
          <SkeletonList label="Loading usage" rows={2} compact />
        )}
      </SettingsSection>

      {owner && <SampleData workspaceId={workspace._id} />}

      {owner && (
        <SettingsSection title="Export data" description="Download every note, idea, draft, and post in this workspace as JSON.">
          <Button variant="secondary" className="self-start" onClick={() => void exportData()} disabled={exporting}>
            {exporting ? <Spinner /> : <Download size={14} strokeWidth={1.75} />}
            Export workspace
          </Button>
        </SettingsSection>
      )}

      {owner && (
        <SettingsSection
          tone="danger"
          title="Delete workspace"
          description="Deletes the workspace and everything in it for every member: notes, ideas, drafts, keys, and members. This cannot be undone."
        >
          <label htmlFor="confirm-delete" className="text-[13px]">
            Type <span className="font-mono font-medium">{workspace.name}</span> to confirm.
          </label>
          <input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          <Button variant="danger" className="self-start" disabled={confirm !== workspace.name || deleting} onClick={() => void remove()}>
            {deleting && <Spinner />}
            Delete workspace
          </Button>
        </SettingsSection>
      )}
    </div>
  );
}

function SampleData({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const status = useQuery(api.demo.status, { workspaceId });
  const seed = useMutation(api.demo.seed);
  const clear = useMutation(api.demo.clear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status?.available) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Sample data"
      description={
        status.loaded
          ? "Sample teammates, posts, clicks, signups, and scheduled drafts are loaded. Removing them leaves your own work untouched."
          : "Add three sample teammates with a month of posts, link clicks, signups, and a week of scheduled drafts. Useful for trying the calendar and recap. Only on self-hosted installs."
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        variant="secondary"
        className="self-start"
        disabled={busy}
        onClick={() => void run(() => (status.loaded ? clear({ workspaceId }) : seed({ workspaceId })))}
      >
        {busy && <Spinner />}
        {status.loaded ? "Remove sample data" : "Add sample data"}
      </Button>
    </SettingsSection>
  );
}
