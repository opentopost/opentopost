import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireIdentity, requireMember, requirePrimaryOwner as requireOwner } from "./lib/auth";
import { kindeApi, m2mConfigured, m2mToken, type OrgBilling } from "./lib/kinde";
import { checkoutKey, entitlementsFor, kindeBilling, monthOf, planFromKey, seatCount, TEAM_INCLUDED_SEATS } from "./lib/plan";


const INTENT_TTL = 2 * 60 * 60 * 1000;

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const ent = await entitlementsFor(ctx, args.workspaceId);
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_workspace_month", (q) => q.eq("workspaceId", args.workspaceId).eq("month", monthOf()))
      .unique();
    const workspace = await ctx.db.get(args.workspaceId);
    const cap = (n: number) => (Number.isFinite(n) ? n : null);
    return {
      mode: ent.mode,
      plan: ent.plan,
      status: ent.status,
      periodEnd: ent.periodEnd,
      features: ent.features,
      limits: {
        membersPerWorkspace: cap(ent.limits.membersPerWorkspace),
        manualScansPerDay: cap(ent.limits.manualScansPerDay),
        sources: cap(ent.limits.sources),
        mcpServers: cap(ent.limits.mcpServers),
      },
      seats: await seatCount(ctx, args.workspaceId),
      includedSeats: TEAM_INCLUDED_SEATS,
      ai: { used: usage?.calls ?? 0, included: ent.aiCallsPerMonth, month: monthOf() },
      useOwnKey: workspace?.useOwnKey ?? false,
      hasBillingOrg: Boolean(ent.billingOrgCode),
      billingOrgCode: member.role === "owner" ? ent.billingOrgCode : null,
      canManage: member.role === "owner",
      syncAvailable: m2mConfigured(),
      billing: kindeBilling() ? ("kinde" as const) : ("manual" as const),
      manualPlan: workspace?.manualPlan ? { plan: workspace.manualPlan.plan, until: workspace.manualPlan.until ?? null } : null,
      // A free Team pilot that has not ended: shown to the owner so the end date is no surprise.
      pilot:
        workspace?.pilot && !workspace.pilot.endedAt
          ? { endsAt: workspace.pilot.endsAt, graceUntil: workspace.pilot.endsAt + workspace.pilot.graceDays * 24 * 60 * 60 * 1000 }
          : null,
      openRequest: await (async () => {
        const request = (
          await ctx.db
            .query("planRequests")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect()
        ).find((row) => row.status === "open");
        return request ? { plan: request.plan, createdAt: request.createdAt } : null;
      })(),
    };
  },
});

function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/** Starts an upgrade. Returns where the browser goes next. */
export const startCheckout = mutation({
  args: { workspaceId: v.id("workspaces"), plan: v.union(v.literal("pro"), v.literal("team")) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new ConvexError("Workspace not found.");
    const ent = await entitlementsFor(ctx, args.workspaceId);
    if (ent.mode === "selfhosted") throw new ConvexError("Billing is off on self-hosted opentopost. Everything is already included.");
    if (!kindeBilling()) throw new ConvexError("Card payments are not on yet. Request the plan in Settings > Billing and we will email you.");
    if (args.plan === "pro" && (await seatCount(ctx, args.workspaceId)) > 1) {
      throw new ConvexError("Pro is for one person. This workspace has more members, so choose Team.");
    }
    if (workspace.billingOrgCode) {
      return { kind: "portal" as const, orgCode: workspace.billingOrgCode };
    }
    const token = randomToken();
    await ctx.db.insert("billingIntents", {
      workspaceId: args.workspaceId,
      memberId: owner._id,
      plan: args.plan,
      token,
      createdAt: Date.now(),
    });
    return { kind: "checkout" as const, token, planKey: checkoutKey(args.plan), orgName: workspace.name };
  },
});

/** Called after Kinde creates the organization and takes payment. Links the org to the workspace. */
export const completeCheckout = mutation({
  args: { token: v.string(), orgCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const intent = await ctx.db
      .query("billingIntents")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!intent || intent.createdAt + INTENT_TTL < Date.now()) {
      throw new ConvexError("This upgrade link has expired. Start again from Settings > Billing.");
    }
    const member = await ctx.db.get(intent.memberId);
    if (!member || member.kindeUserId !== identity.subject) throw new ConvexError("Only the person who started the upgrade can finish it.");
    if (intent.completedAt) return intent.workspaceId;

    const orgCodes = (identity as Record<string, unknown>).org_codes;
    if (Array.isArray(orgCodes) && !orgCodes.includes(args.orgCode)) {
      throw new ConvexError("You are not a member of that organization.");
    }
    const taken = await ctx.db
      .query("workspaces")
      .withIndex("by_billing_org", (q) => q.eq("billingOrgCode", args.orgCode))
      .first();
    if (taken && taken._id !== intent.workspaceId) {
      throw new ConvexError("That organization already pays for another workspace.");
    }
    await ctx.db.patch(intent.workspaceId, { billingOrgCode: args.orgCode });
    await ctx.db.patch(intent._id, { completedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.billing.syncFromKinde, { workspaceId: intent.workspaceId });
    return intent.workspaceId;
  },
});

export const setUseOwnKey = mutation({
  args: { workspaceId: v.id("workspaces"), useOwnKey: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    await ctx.db.patch(args.workspaceId, { useOwnKey: args.useOwnKey });
  },
});

export const billingTarget = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace?.billingOrgCode) return null;
    const ent = await entitlementsFor(ctx, args.workspaceId);
    return { orgCode: workspace.billingOrgCode, plan: ent.plan, seats: await seatCount(ctx, args.workspaceId) };
  },
});

async function orgBilling(orgCode: string): Promise<{ token: string; billing: OrgBilling["billing"] } | null> {
  const token = await m2mToken();
  if (!token) return null;
  const org = await kindeApi<OrgBilling>(token, `/api/v1/organization?code=${encodeURIComponent(orgCode)}&expand=billing`);
  return { token, billing: org.billing };
}

/** Reads the org's plan straight from Kinde, so the app does not wait for a webhook. Needs the M2M app. */
export const syncFromKinde = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const target = await ctx.runQuery(internal.billing.billingTarget, args);
    if (!target) return { ok: false, message: "This workspace has no paid plan yet." };
    const result = await orgBilling(target.orgCode);
    if (!result) return { ok: false, message: "Plan changes arrive from Kinde within a minute." };
    const agreement = (result.billing?.agreements ?? []).find((row) => planFromKey(row.plan_code));
    if (!agreement) return { ok: true, message: "Kinde shows no paid plan for this workspace." };
    await ctx.runMutation(components.convexKindeBilling.lib.handleWebhookEvent, {
      eventType: "customer.plan_assigned",
      customerId: target.orgCode,
      customerType: "org",
      payload: JSON.stringify({ source: "opentopost-sync", agreement }),
      planId: agreement.plan_code,
      planName: agreement.plan_code,
      agreementId: agreement.agreement_id,
    });
    await ctx.scheduler.runAfter(0, internal.billing.syncSeats, args);
    return { ok: true, message: "Plan updated from Kinde." };
  },
});

export const refresh = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    await ctx.runQuery(internal.billing.assertOwner, args);
    try {
      return await ctx.runAction(internal.billing.syncFromKinde, args);
    } catch {
      return { ok: false, message: "Kinde did not answer. Try again in a minute." };
    }
  },
});

export const assertOwner = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
  },
});

/** Team includes three members. Every member after that is reported to Kinde as usage. */
export const syncSeats = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.billing.billingTarget, args);
    if (!target || target.plan !== "team") return;
    const result = await orgBilling(target.orgCode);
    if (!result) return;
    const agreement = (result.billing?.agreements ?? []).find((row) => planFromKey(row.plan_code) === "team");
    if (!agreement?.agreement_id) return;
    await kindeApi(result.token, "/api/v1/billing/meter_usage", {
      method: "POST",
      body: JSON.stringify({
        customer_agreement_id: agreement.agreement_id,
        billing_feature_code: process.env.KINDE_SEAT_FEATURE ?? "extra_members",
        meter_value: String(Math.max(0, target.seats - TEAM_INCLUDED_SEATS)),
        meter_type_code: "absolute",
      }),
    });
  },
});

export const recordUsage = internalMutation({
  args: { workspaceId: v.id("workspaces"), input: v.number(), output: v.number() },
  handler: async (ctx, args) => {
    const month = monthOf();
    const row = await ctx.db
      .query("aiUsage")
      .withIndex("by_workspace_month", (q) => q.eq("workspaceId", args.workspaceId).eq("month", month))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        calls: row.calls + 1,
        inputTokens: row.inputTokens + args.input,
        outputTokens: row.outputTokens + args.output,
      });
    } else {
      await ctx.db.insert("aiUsage", {
        workspaceId: args.workspaceId,
        month,
        calls: 1,
        inputTokens: args.input,
        outputTokens: args.output,
      });
    }
  },
});

/** Records that an owner wants a paid plan. We follow up by email and set the plan by hand. */
export const requestPlan = mutation({
  args: { workspaceId: v.id("workspaces"), plan: v.union(v.literal("pro"), v.literal("team")) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const identity = await requireIdentity(ctx);
    const seats = await seatCount(ctx, args.workspaceId);
    if (args.plan === "pro" && seats > 1) {
      throw new ConvexError("Pro is for one person. This workspace has more members, so choose Team.");
    }
    const open = (
      await ctx.db
        .query("planRequests")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).filter((row) => row.status === "open");
    for (const row of open) await ctx.db.patch(row._id, { status: "dismissed", resolvedAt: Date.now() });
    await ctx.db.insert("planRequests", {
      workspaceId: args.workspaceId,
      memberId: owner._id,
      plan: args.plan,
      name: owner.name,
      email: owner.email ?? identity.email ?? undefined,
      seats,
      status: "open",
      createdAt: Date.now(),
    });
  },
});
