"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { Badge, Button, buttonClass, Card, Check, Notice, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { PLANS } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { SkeletonList } from "@/components/loader";
import { errorMessage } from "@/lib/format";

const PLAN_NAME = { free: "Free", pro: "Pro", team: "Team" } as const;

const STATUS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  past_due: "Payment failed. Update your card to keep your plan.",
  unpaid: "Unpaid",
  unknown: "Waiting for Kinde",
};

function dateLabel(time: number) {
  return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function BillingSettings() {
  const { workspace } = useWorkspace();
  const params = useSearchParams();
  const status = useQuery(api.billing.status, { workspaceId: workspace._id });
  const refresh = useAction(api.billing.refresh);
  const requestPlan = useMutation(api.billing.requestPlan);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (status === undefined) return <SkeletonList label="Loading billing" />;

  if (status.mode === "selfhosted") {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-[16px] font-medium">Billing is off</h2>
        <p className="text-[14px] text-muted">
          This is a self-hosted copy of opentopost, so every feature is included and there is nothing to pay. You pay your
          own model provider, Convex, and Kinde directly.
        </p>
      </Card>
    );
  }

  const error = params.get("error");
  const upgraded = params.get("upgraded");
  const changed = params.get("changed");
  const ws = workspace._id;
  const paid = status.plan !== "free";
  const usedShare = status.ai.included ? Math.min(100, Math.round((status.ai.used / status.ai.included) * 100)) : 0;

  const manual = status.billing === "manual";

  async function request(plan: "pro" | "team") {
    setRequesting(plan);
    setRequestError(null);
    try {
      await requestPlan({ workspaceId: ws, plan });
      if (SITE.contactEmail) {
        const name = PLAN_NAME[plan];
        const body = [
          `Hi, I would like the ${name} plan for my workspace.`,
          "",
          `Workspace: ${workspace.name}`,
          `Members: ${status?.seats ?? 1}`,
          "",
          "Please send me an invoice.",
        ].join("\n");
        window.location.assign(`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`opentopost ${name} plan`)}&body=${encodeURIComponent(body)}`);
      }
    } catch (err) {
      setRequestError(errorMessage(err));
    } finally {
      setRequesting(null);
    }
  }

  async function runRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      setRefreshResult(await refresh({ workspaceId: ws }));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      {requestError && <Notice tone="error">{requestError}</Notice>}
      {manual && status.openRequest && !paid && (
        <Notice tone="ok">
          You asked for {PLAN_NAME[status.openRequest.plan]} on {dateLabel(status.openRequest.createdAt)}. We will email you an invoice
          and turn the plan on when it is paid.
        </Notice>
      )}
      {upgraded && (
        <Notice tone="ok">
          {paid
            ? `You are on ${PLAN_NAME[status.plan]}. Thank you.`
            : "Payment received. Your plan shows here within a minute."}
        </Notice>
      )}
      {changed && !upgraded && <Notice tone="ok">Plan changes show here within a minute.</Notice>}

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-muted">Current plan</p>
            <div className="flex items-center gap-2">
              <h2 className="text-[24px] tracking-[-0.02em]">{PLAN_NAME[status.plan]}</h2>
              {status.status && <Badge tone={status.status === "active" ? "lime" : "danger"}>{STATUS[status.status] ?? status.status}</Badge>}
            </div>
            {manual && status.manualPlan && paid && (
              <p className="text-[13px] text-muted">{status.pilot ? "Free Team pilot" : "Paid by invoice"}</p>
            )}
            {status.pilot && (
              <p className="text-[13px] text-muted">
                The pilot ends on {dateLabel(status.pilot.endsAt)}. After that, your workspace moves to Free and nothing is deleted. To continue on Team,
                email us and we send the payment details.
              </p>
            )}
            {status.periodEnd && !status.pilot && (
              <p className="text-[13px] text-muted">
                {status.status === "cancelled" || status.manualPlan ? "Paid until" : "Renews on"} {dateLabel(status.periodEnd)}
              </p>
            )}
          </div>
          {status.canManage && status.hasBillingOrg && (
            <div className="flex flex-wrap gap-2">
              <a href={`/billing/manage?ws=${ws}&page=organization_payment_details`} className={buttonClass("secondary", "md")}>
                Payment details
              </a>
              <a href={`/billing/manage?ws=${ws}&page=organization_plan_details`} className={buttonClass("dark", "md")}>
                Manage plan
                <ArrowUpRight size={14} strokeWidth={1.75} />
              </a>
            </div>
          )}
        </div>

        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[13px] text-muted">Members</p>
            <p className="text-[16px] font-medium">
              {status.seats}
              {status.limits.membersPerWorkspace !== null && ` of ${status.limits.membersPerWorkspace}`}
            </p>
            {status.plan === "team" && (
              <p className="text-[12px] text-muted">
                {status.includedSeats} included. Each extra member is $15 a month.
              </p>
            )}
          </div>
          <div>
            <p className="text-[13px] text-muted">Models</p>
            <p className="text-[16px] font-medium">
              {status.features.hostedModels && !status.useOwnKey ? "Included" : "Your own key"}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-muted">Manual scans a day</p>
            <p className="text-[16px] font-medium">{status.limits.manualScansPerDay ?? "No limit"}</p>
          </div>
        </div>

        {status.ai.included !== null && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Included AI this month</span>
              <span className="font-mono text-ink">
                {status.ai.used.toLocaleString("en-US")} / {status.ai.included.toLocaleString("en-US")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuenow={usedShare} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full ${usedShare >= 90 ? "bg-danger" : "bg-accent"}`} style={{ width: `${usedShare}%` }} />
            </div>
            <p className="text-[12px] text-muted">
              Resets on the first of each month. If you run out, add your own key in Settings &gt; Model.
            </p>
          </div>
        )}

        {status.canManage && status.hasBillingOrg && status.syncAvailable && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => void runRefresh()} disabled={refreshing}>
              {refreshing ? <Spinner /> : <RefreshCw size={13} strokeWidth={1.75} />}
              Check plan with Kinde
            </Button>
            {refreshResult && <span className={`text-[13px] ${refreshResult.ok ? "text-muted" : "text-danger"}`}>{refreshResult.message}</span>}
          </div>
        )}
      </Card>

      {!status.canManage ? (
        <p className="text-[14px] text-muted">Only a workspace owner can change the plan.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.filter((plan) => plan.id === "pro" || plan.id === "team").map((plan) => {
            const current = status.plan === plan.id;
            const proBlocked = plan.id === "pro" && status.seats > 1;
            return (
              <Card key={plan.id} className="flex flex-col overflow-hidden p-0">
                <div className={`flex flex-col gap-1 border-b border-line p-5 md:min-h-[92px] ${plan.tone}`}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[18px] font-medium">{plan.name}</h3>
                    {current && <Badge tone="lime">Current</Badge>}
                  </div>
                  <p className="text-[13px] text-body">{plan.who}</p>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <span className="text-[32px] leading-none tracking-[-0.03em]">{plan.price}</span>{" "}
                    <span className="text-[13px] text-muted">{plan.period}</span>
                    {plan.yearly && <p className="text-[12px] text-muted">or {plan.yearly}</p>}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex gap-2 text-[13px] text-ink">
                        <Check className="mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {current ? (
                      manual ? (
                        <p className="text-[13px] text-muted">This is your plan. Email us to change or cancel it.</p>
                      ) : (
                        <a href={`/billing/manage?ws=${ws}&page=organization_plan_details`} className={buttonClass("secondary", "md", "w-full")}>
                          Manage plan
                        </a>
                      )
                    ) : proBlocked ? (
                      <p className="text-[13px] text-muted">Pro is for one person. This workspace has {status.seats} members.</p>
                    ) : manual ? (
                      <Button
                        variant={plan.id === "team" ? "primary" : "dark"}
                        size="md"
                        className="w-full"
                        disabled={requesting !== null}
                        data-track={`Request ${plan.name} plan`}
                        onClick={() => void request(plan.id as "pro" | "team")}
                      >
                        {requesting === plan.id && <Spinner />}
                        {status.openRequest?.plan === plan.id ? `Requested. Ask again` : `Get ${plan.name}`}
                      </Button>
                    ) : (
                      <a href={`/billing/checkout?plan=${plan.id}&ws=${ws}`} className={buttonClass(plan.id === "team" ? "primary" : "dark", "md", "w-full")}>
                        {paid ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-medium">Enterprise</h3>
          <p className="text-[13px] text-muted">SSO with SAML and SCIM, audit logs, and help running opentopost yourself.</p>
        </div>
        {SITE.contactEmail ? (
          <a href={`mailto:${SITE.contactEmail}?subject=opentopost%20Enterprise`} className={buttonClass("secondary", "md")}>
            Contact us
          </a>
        ) : (
          <a href={SITE.repo} className={buttonClass("secondary", "md")}>
            Self-host instead
          </a>
        )}
      </Card>

      <p className="text-[12px] text-muted">
        {manual
          ? "While we onboard our first teams, we set up paid plans by hand. Ask for a plan and we email you an invoice. Your plan turns on as soon as it is paid."
          : "Payments run through Kinde Billing and Stripe. opentopost never sees your card number."}
      </p>
    </div>
  );
}
