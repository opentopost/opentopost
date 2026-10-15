"use client";

import { LogoutLink, PortalLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { useAction } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { SettingsSection } from "@/components/settings";
import { Button, buttonClass, inputClass, Notice, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";

const CONFIRM = "delete my account";

export default function AccountSettings() {
  const { member, mode } = useWorkspace();
  const deleteAccount = useAction(api.account.deleteAccount);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deleteAccount({ confirm });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/api/auth/logout";
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection title="Profile" description="Your name and email come from your sign-in.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-item border border-line bg-surface p-3">
            <p className="text-[12px] text-muted">Name</p>
            <p className="text-[14px]">{member.name}</p>
          </div>
          <div className="rounded-item border border-line bg-surface p-3">
            <p className="text-[12px] text-muted">Email</p>
            <p className="truncate text-[14px]">{member.email ?? "Not shared"}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sign-in and security"
        description="Change your name, email, and sign-in method, such as Google or email and password."
      >
        <div className="flex flex-wrap gap-2">
          <PortalLink subNav={"profile" as never} returnUrl="/settings/account" className={buttonClass("secondary", "md")}>
            Manage profile and sign-in
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </PortalLink>
          <LogoutLink className={buttonClass("ghost", "md")}>Sign out</LogoutLink>
        </div>
      </SettingsSection>

      <SettingsSection
        tone="danger"
        title="Delete account"
        description={
          <>
            Deletes your account{mode === "hosted" ? " and your data on the hosted version" : ""}. Workspaces where you are
            the only member are deleted with everything in them. In shared workspaces, you leave and your teammates keep
            their work.
          </>
        }
      >
        <label htmlFor="confirm-account" className="text-[13px]">
          Type <span className="font-mono font-medium">{CONFIRM}</span> to confirm.
        </label>
        <input id="confirm-account" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          variant="danger"
          className="self-start"
          disabled={confirm.trim().toLowerCase() !== CONFIRM || pending}
          onClick={() => void remove()}
        >
          {pending && <Spinner />}
          Delete my account
        </Button>
      </SettingsSection>
    </div>
  );
}
