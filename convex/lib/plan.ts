import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { deploymentMode, SELF_HOSTED, type DeploymentMode, type Limits } from "./limits";
import { AI_CALLS, PLAN_LIMITS, PRO_USD_MONTH, TEAM_INCLUDED_SEATS, type Plan } from "./planLimits";

export { AI_CALLS, PLAN_LIMITS, PRO_USD_MONTH, TEAM_INCLUDED_SEATS, type Plan };


export type Features = {
  hostedModels: boolean;
  review: boolean;
  rules: boolean;
  slack: boolean;
  recap: boolean;
  conversions: boolean;
};

const PAID_FEATURES = { review: false, rules: false, slack: false, recap: false, conversions: false };
const TEAM_FEATURES = { review: true, rules: true, slack: true, recap: true, conversions: true };

export type Entitlements = {
  mode: DeploymentMode;
  plan: Plan;
  status: "active" | "cancelled" | "past_due" | "unpaid" | "unknown" | null;
  periodEnd: number | null;
  limits: Limits;
  features: Features;
  aiCallsPerMonth: number | null;
  billingOrgCode: string | null;
};

function keys(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
}

export function planFromKey(planId?: string, planName?: string): Plan | null {
  const id = (planId ?? "").toLowerCase();
  const name = (planName ?? "").toLowerCase();
  if (keys(process.env.KINDE_PLAN_TEAM, "team,team_yearly").includes(id) || /\bteam\b/.test(name)) return "team";
  if (keys(process.env.KINDE_PLAN_PRO, "pro,pro_yearly").includes(id) || /\bpro\b/.test(name)) return "pro";
  return null;
}

/** The Kinde plan key used to start checkout for a plan. */
export function checkoutKey(plan: Exclude<Plan, "free">): string {
  return keys(plan === "team" ? process.env.KINDE_PLAN_TEAM : process.env.KINDE_PLAN_PRO, plan)[0];
}

/**
 * Paid plans run on Claude with our own key. Gemini, when its key is set, only reads
 * voice recordings and videos, which Claude cannot hear.
 */
export function hostedProvider(media = false): "anthropic" | "google" | null {
  if (media && process.env.HOSTED_GOOGLE_API_KEY) return "google";
  if (process.env.HOSTED_ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.HOSTED_GOOGLE_API_KEY) return "google";
  return null;
}

export function hostedApiKey(provider: string): string | undefined {
  if (provider === "anthropic") return process.env.HOSTED_ANTHROPIC_API_KEY;
  if (provider === "google") return process.env.HOSTED_GOOGLE_API_KEY;
  return undefined;
}

/** Kinde Billing checkout is on only when KINDE_BILLING is "on". Until then, people request a plan by email. */
export function kindeBilling(): boolean {
  return process.env.KINDE_BILLING === "on";
}

export function hostedKeyAvailable(): boolean {
  return hostedProvider() !== null;
}

export async function entitlements(
  ctx: QueryCtx | MutationCtx,
  workspace: Doc<"workspaces">,
): Promise<Entitlements> {
  const mode = deploymentMode();
  if (mode === "selfhosted") {
    return {
      mode,
      plan: "team",
      status: null,
      periodEnd: null,
      limits: SELF_HOSTED,
      features: { hostedModels: false, ...TEAM_FEATURES },
      aiCallsPerMonth: null,
      billingOrgCode: null,
    };
  }

  let plan: Plan = "free";
  let status: Entitlements["status"] = null;
  let periodEnd: number | null = null;
  if (workspace.billingOrgCode) {
    const subscription = await (ctx as QueryCtx).runQuery(components.convexKindeBilling.lib.getSubscription, {
      customerId: workspace.billingOrgCode,
    });
    if (subscription) {
      status = subscription.status;
      periodEnd = subscription.currentPeriodEnd ?? null;
      const paidUntil = subscription.currentPeriodEnd ?? 0;
      const paying =
        subscription.status === "active" ||
        subscription.status === "past_due" ||
        (subscription.status === "cancelled" && paidUntil > Date.now());
      const matched = planFromKey(subscription.planId, subscription.planName);
      if (paying && matched) plan = matched;
    }
  }

  // Plans set by hand (paid by invoice) count when no Kinde subscription is paying.
  const manual = workspace.manualPlan;
  if (plan === "free" && manual && (!manual.until || manual.until > Date.now())) {
    plan = manual.plan;
    status = "active";
    periodEnd = manual.until ?? null;
  }

  let aiCallsPerMonth: number | null = null;
  if (plan === "pro") aiCallsPerMonth = AI_CALLS.pro;
  if (plan === "team") {
    const members = await seatCount(ctx, workspace._id);
    aiCallsPerMonth = AI_CALLS.teamPerSeat * Math.max(TEAM_INCLUDED_SEATS, members);
  }

  return {
    mode,
    plan,
    status,
    periodEnd,
    limits: PLAN_LIMITS[plan],
    features: {
      hostedModels: plan !== "free" && hostedKeyAvailable(),
      ...(plan === "team" ? TEAM_FEATURES : PAID_FEATURES),
    },
    aiCallsPerMonth,
    billingOrgCode: workspace.billingOrgCode ?? null,
  };
}

export function modelReady(ent: Entitlements, workspace: Doc<"workspaces">): boolean {
  return Boolean(workspace.defaultProvider) || (ent.features.hostedModels && !workspace.useOwnKey);
}

export async function entitlementsFor(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Workspace not found.");
  return entitlements(ctx, workspace);
}

export async function seatCount(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return members.length;
}

export const FEATURE_NAMES: Record<keyof Omit<Features, "hostedModels">, string> = {
  review: "Review before posting",
  rules: "Company rules",
  slack: "Slack",
  recap: "Weekly recaps",
  conversions: "Signup tracking",
};

export function teamOnly(feature: keyof typeof FEATURE_NAMES): string {
  return `${FEATURE_NAMES[feature]} is part of the Team plan. Upgrade in Settings > Billing.`;
}

export function monthOf(time = Date.now()): string {
  return new Date(time).toISOString().slice(0, 7);
}
