import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requestScan } from "./ideas";
import { requireMember, requireOwner } from "./lib/auth";
import { audit } from "./lib/ops";

/*
 * The distribution audit: the ten best untold stories from the last 30 days, each
 * with the person who should tell it, on a page the founder can share.
 * It uses moments from every connected source, and starts a scan when there are too few.
 */

const WINDOW = 30 * 24 * 60 * 60 * 1000;
const KIND_WEIGHT: Record<string, number> = { measured: 12, customer: 10, shipped: 8, milestone: 8, learned: 6, decided: 5, opinion: 4, hiring: 3 };

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 18);
}

export const start = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<string> => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const id = token();
    const auditId = await ctx.db.insert("distributionAudits", {
      workspaceId: args.workspaceId,
      token: id,
      createdBy: owner._id,
      createdAt: Date.now(),
      status: "running",
      stories: [],
      sources: [],
    });
    await audit(ctx, args.workspaceId, { member: owner, via: "app" }, "audit.started");
    await ctx.scheduler.runAfter(0, internal.audits.build, { auditId, attempt: 0 });
    return id;
  },
});

async function storiesFor(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const since = Date.now() - WINDOW;
  const moments = (
    await ctx.db
      .query("moments")
      .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", workspaceId).gte("occurredAt", since))
      .collect()
  ).filter((moment) => moment.status === "active");
  const ideas = await ctx.db
    .query("ideas")
    .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(300);
  const posted = new Set(
    (
      await ctx.db
        .query("drafts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
    )
      .filter((draft) => draft.status === "posted" && draft.momentId)
      .map((draft) => draft.momentId as string),
  );
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const scored = [];
  for (const moment of moments) {
    if (posted.has(moment._id)) continue;
    const idea = ideas.find((row) => row.momentId === moment._id);
    const fact = moment.facts.find((row) => row.quote) ?? moment.facts[0];
    const item = fact?.sourceItemId ? await ctx.db.get(fact.sourceItemId) : null;
    const suggested = idea?.suggestedMemberId ? members.find((member) => member._id === idea.suggestedMemberId) : null;
    const named = moment.people.find((name) => members.some((member) => member.name.toLowerCase().startsWith(name.toLowerCase())));
    const score = Math.round((idea?.score ?? 60) + (KIND_WEIGHT[moment.kind] ?? 0) + Math.min(moment.facts.length, 4) * 2);
    scored.push({
      title: idea?.title ?? moment.title,
      why: idea?.angle ?? moment.summary,
      person: suggested?.name ?? named ?? moment.people[0] ?? "The person closest to it",
      kind: moment.kind,
      score: Math.min(score, 99),
      quote: fact?.quote,
      sourceTitle: item?.title,
      sourceUrl: item?.url,
      momentId: moment._id,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const sources = (
    await ctx.db
      .query("sources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect()
  )
    .filter((source) => source.enabled)
    .map((source) => source.type);
  return { stories: scored.slice(0, 10), sources: [...new Set(sources)] };
}

/** True while a scan for this workspace started in the last 15 minutes is still running. */
async function scanRunning(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const recent = await ctx.db
    .query("runs")
    .withIndex("by_workspace_kind_started", (q) => q.eq("workspaceId", workspaceId).eq("kind", "scan").gt("startedAt", Date.now() - 15 * 60 * 1000))
    .collect();
  return recent.some((run) => run.status === "running");
}

// Check every 10 seconds, for at most 6 minutes.
const CHECK_EVERY = 10_000;
const MAX_CHECKS = 36;

export const build = internalMutation({
  args: { auditId: v.id("distributionAudits"), attempt: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.auditId);
    if (!row || row.status !== "running") return;
    if (args.attempt === 0) {
      const { stories } = await storiesFor(ctx, row.workspaceId);
      if (stories.length < 5) {
        try {
          await requestScan(ctx, { workspaceId: row.workspaceId });
        } catch {
          // A scan may already be running, or the daily limit is used. Use what exists.
        }
      }
    }
    // Finish as soon as no scan is running: the stories will not change any more.
    const waiting = (await scanRunning(ctx, row.workspaceId)) && args.attempt < MAX_CHECKS;
    if (!waiting) {
      const { stories, sources } = await storiesFor(ctx, row.workspaceId);
      await ctx.db.patch(row._id, {
        status: stories.length ? "ready" : "failed",
        stories,
        sources,
        error: stories.length ? undefined : "No moments were found in the last 30 days. Connect a source with recent work, then run the audit again.",
      });
      return;
    }
    await ctx.scheduler.runAfter(CHECK_EVERY, internal.audits.build, { auditId: row._id, attempt: args.attempt + 1 });
  },
});

/** The shared page reads an audit by its token. No sign-in. */
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("distributionAudits")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!row) return null;
    const workspace = await ctx.db.get(row.workspaceId);
    return {
      workspace: workspace?.name ?? "Your team",
      status: row.status,
      createdAt: row.createdAt,
      sources: row.sources,
      error: row.error ?? null,
      stories: row.stories.map((story) => ({
        title: story.title,
        why: story.why,
        person: story.person,
        kind: story.kind,
        score: story.score,
        quote: story.quote ?? null,
        sourceTitle: story.sourceTitle ?? null,
      })),
    };
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows: Doc<"distributionAudits">[] = await ctx.db
      .query("distributionAudits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(10);
    return rows.map((row) => ({ token: row.token, status: row.status, createdAt: row.createdAt, stories: row.stories.length }));
  },
});

export const remove = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("distributionAudits")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!row) throw new ConvexError("This audit no longer exists.");
    await requireOwner(ctx, row.workspaceId);
    await ctx.db.delete(row._id);
  },
});
