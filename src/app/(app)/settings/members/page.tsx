"use client";

import { isManager, ROLE_HELP, ROLE_LABELS } from "@/lib/roles";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check as CheckIcon, Copy, Link2, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { SettingsSection } from "@/components/settings";
import { Badge, Button, fieldClass, inputClass, Notice, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";

type Role = "owner" | "admin" | "reviewer" | "member";
const ROLE_OPTIONS: Role[] = ["member", "reviewer", "admin", "owner"];

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(inviteUrl(token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <CheckIcon size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export default function MembersSettings() {
  const { workspace, member: me, limits } = useWorkspace();
  const data = useQuery(api.members.list, { workspaceId: workspace._id });
  const createInvite = useAction(api.members.createInvite);
  const revokeInvite = useMutation(api.members.revokeInvite);
  const setRole = useMutation(api.members.setRole);
  const remove = useMutation(api.members.remove);
  const owner = isManager(me.role);
  const primary = me.role === "owner";

  const [email, setEmail] = useState("");
  const [role, setNewRole] = useState<Role>("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCreated(null);
    try {
      const token = await createInvite({ workspaceId: workspace._id, email: email || undefined, role });
      setCreated(token);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {owner && (
        <SettingsSection
          title="Invite people"
          description={
            <>
              Create a link and send it to a teammate. Each link works once and expires in 7 days.
              {limits.membersPerWorkspace !== null && ` This workspace allows ${limits.membersPerWorkspace} members.`}
            </>
          }
        >
          <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="invite-email" className="sr-only">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional, locks the link to this person)"
              className={inputClass}
            />
            <label htmlFor="invite-role" className="sr-only">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className={`${fieldClass} w-full sm:w-36`}
            >
              {ROLE_OPTIONS.filter((value) => value !== "owner" || primary).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
            <Button type="submit" size="md" disabled={pending}>
              {pending ? <Spinner /> : <Link2 size={14} strokeWidth={1.75} />}
              Create link
            </Button>
          </form>
          {created && (
            <div className="flex flex-col gap-2 rounded-item bg-lime p-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-lime-ink">{inviteUrl(created)}</p>
              <CopyButton token={created} />
            </div>
          )}
        </SettingsSection>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <SettingsSection title="Members" description="Owners do everything, including billing. Admins manage sources, rules, members, and settings. Reviewers approve drafts. Members write and post their own.">
        {data === undefined ? (
          <SkeletonList label="Loading members" rows={2} compact />
        ) : (
          <ul className="overflow-hidden rounded-item border border-line">
            {data.members.map((row) => (
              <li key={row._id} className="flex flex-wrap items-center gap-3 border-t border-line bg-surface px-3 py-2.5 first:border-t-0">
                <span className="inline-flex size-7 items-center justify-center rounded-control bg-sky-mid text-[11px] font-semibold">
                  {row.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {row.name} {row.isMe && <span className="font-normal text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {row.email ?? "No email"}, joined {timeAgo(row.joinedAt)}
                  </p>
                </div>
                {owner ? (
                  <select
                    aria-label={`Role for ${row.name}`}
                    value={row.role}
                    onChange={(e) => void act(() => setRole({ memberId: row._id, role: e.target.value as Role }))}
                    className={`${fieldClass} h-8 w-28`}
                    disabled={row.role === "owner" && !primary}
                    title={ROLE_HELP[row.role as Role]}
                  >
                    {ROLE_OPTIONS.filter((value) => value !== "owner" || primary || row.role === "owner").map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone="fill">{ROLE_LABELS[row.role as Role]}</Badge>
                )}
                {(owner || row.isMe) && (
                  <Button
                    variant="danger"
                    onClick={() => void act(() => remove({ memberId: row._id as Id<"members"> }))}
                  >
                    {row.isMe ? "Leave" : "Remove"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {owner && data && data.invites.length > 0 && (
        <SettingsSection title="Pending invites" description="Links that nobody has used yet.">
          <ul className="overflow-hidden rounded-item border border-line">
            {data.invites.map((invite) => (
              <li key={invite._id} className="flex flex-wrap items-center gap-3 border-t border-line bg-surface px-3 py-2.5 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{invite.email ?? "Anyone with the link"}</p>
                  <p className="text-[12px] text-muted">
                    {ROLE_LABELS[invite.role as Role]}, expires {timeAgo(invite.expiresAt)}
                  </p>
                </div>
                <CopyButton token={invite.token} />
                <Button
                  variant="ghost"
                  aria-label="Revoke invite"
                  className="w-8 px-0"
                  onClick={() => void act(() => revokeInvite({ inviteId: invite._id }))}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}
    </div>
  );
}
