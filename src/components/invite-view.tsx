"use client";

import { LoginLink, LogoutLink, RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Mark } from "@/components/mark";
import { Button, buttonClass, Notice, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import { SkeletonList } from "./loader";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid-faint flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-card border border-line bg-surface p-8 text-center">
        <Mark size={48} />
        {children}
      </div>
    </main>
  );
}

function Invite({ token }: { token: string }) {
  const router = useRouter();
  const info = useQuery(api.members.inviteInfo, { token });
  const accept = useMutation(api.members.acceptInvite);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (info === undefined) return <p className="text-muted">Checking your invite</p>;

  if (info.status === "invalid" || info.status === "expired" || info.status === "used") {
    return (
      <>
        <h1 className="text-[20px] font-medium">This invite no longer works</h1>
        <p className="text-[14px] text-muted">Ask the person who invited you for a new link.</p>
      </>
    );
  }

  if (info.status === "member") {
    return (
      <>
        <h1 className="text-[20px] font-medium">You are already in {info.workspaceName}</h1>
        <Button size="md" onClick={() => router.push("/dashboard")}>
          Open dashboard
        </Button>
      </>
    );
  }

  if (info.status === "wrong-email") {
    return (
      <>
        <h1 className="text-[20px] font-medium">This invite is for {info.email}</h1>
        <p className="text-[14px] text-muted">Sign out, then sign in with that email.</p>
        <LogoutLink className={buttonClass("secondary", "md")}>Sign out</LogoutLink>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[20px] font-medium">Join {info.workspaceName}</h1>
      <p className="text-[14px] text-muted">
        {info.inviter ? `${info.inviter} invited you` : "You are invited"} to join as {info.role === "owner" ? "an owner" : info.role === "admin" ? "an admin" : info.role === "reviewer" ? "a reviewer" : "a member"}.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        size="md"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await accept({ token });
            router.push("/dashboard");
          } catch (err) {
            setError(errorMessage(err));
            setPending(false);
          }
        }}
      >
        {pending && <Spinner />}
        Join workspace
      </Button>
    </>
  );
}

export function InviteView() {
  const { token } = useParams<{ token: string }>();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const back = `/invite/${token}`;

  return (
    <Frame>
      {isLoading ? (
        <SkeletonList label="Loading" />
      ) : isAuthenticated ? (
        <Invite token={token} />
      ) : (
        <>
          <h1 className="text-[20px] font-medium">You are invited to opentopost</h1>
          <p className="text-[14px] text-muted">Create an account or sign in to join the workspace.</p>
          <div className="flex gap-2">
            <RegisterLink postLoginRedirectURL={back} className={buttonClass("primary", "md")}>
              Create account
            </RegisterLink>
            <LoginLink postLoginRedirectURL={back} className={buttonClass("secondary", "md")}>
              Sign in
            </LoginLink>
          </div>
        </>
      )}
    </Frame>
  );
}
