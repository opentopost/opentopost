import { uniqueMoments } from "./lib/dedupe";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";

/*
 * Version 0 of opentopost's intelligence, built on the outcome dataset:
 * - pipeline scores: which kinds of moments, told by which roles, bring clicks and signups
 * - shipped vs told: what the team did, against what it posted
 * - the audit log, for owners and admins
 * When enough outcomes exist, a trained model replaces the averages here.
 */

const DAY = 24 * 60 * 60 * 1000;

type Outcome = { posts: number; clicks: number; conversions: number };

async function outcomesByKind(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_workspace_posted", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(500);
  const links = await ctx.db
    .query("trackedLinks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const conversions = await ctx.db
    .query("conversions")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(2000);
  const byLink = new Map<string, number>();
  for (const row of conversions) if (row.trackedLinkId) byLink.set(row.trackedLinkId, (byLink.get(row.trackedLinkId) ?? 0) + 1);
  const byKind = new Map<string, Outcome>();
  const byRole = new Map<string, Outcome>();
  for (const post of posts) {
    const draft = post.draftId ? await ctx.db.get(post.draftId) : null;
    if (draft?.channel === "sample") continue;
    const moment = draft?.momentId ? await ctx.db.get(draft.momentId) : null;
    const member = await ctx.db.get(post.memberId);
    const postLinks = links.filter((link) => link.postId === post._id);
    const clicks = postLinks.reduce((sum, link) => sum + (link.clicks ?? 0), 0);
    const conv = postLinks.reduce((sum, link) => sum + (byLink.get(link._id) ?? 0), 0);
    for (const [map, key] of [
      [byKind, moment?.kind ?? "brief"],
      [byRole, member?.role ?? "member"],
    ] as const) {
      const row = map.get(key) ?? { posts: 0, clicks: 0, conversions: 0 };
      map.set(key, { posts: row.posts + 1, clicks: row.clicks + clicks, conversions: row.conversions + conv });
    }
  }
  return { byKind, byRole, totalPosts: posts.length };
}

/** Expected pipeline for a moment kind: this team's average when it has 3+ posts of that kind, else a neutral prior. */
function expected(byKind: Map<string, Outcome>, kind: string) {
  const all = [...byKind.values()].reduce(
    (sum, row) => ({ posts: sum.posts + row.posts, clicks: sum.clicks + row.clicks, conversions: sum.conversions + row.conversions }),
    { posts: 0, clicks: 0, conversions: 0 },
  );
  const row = byKind.get(kind);
  const base = all.posts ? { clicks: all.clicks / all.posts, conversions: all.conversions / all.posts } : { clicks: 0, conversions: 0 };
  if (!row || row.posts < 3) return { ...base, confident: false, posts: row?.posts ?? 0 };
  return { clicks: row.clicks / row.posts, conversions: row.conversions / row.posts, confident: true, posts: row.posts };
}

/** Pipeline scores for this week's ideas, and what the team's own history says works. */
export const pipeline = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const { byKind, byRole, totalPosts } = await outcomesByKind(ctx, args.workspaceId);
    const ideas = (
      await ctx.db
        .query("ideas")
        .withIndex("by_workspace_week", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(100)
    ).filter((idea) => idea.status === "new" || idea.status === "claimed" || idea.status === "drafted");
    const scored = [];
    for (const idea of ideas) {
      const moment = idea.momentId ? await ctx.db.get(idea.momentId) : null;
      const kind = moment?.kind ?? "brief";
      const guess = expected(byKind, kind);
      // Blend the idea's quality score with the history for its kind.
      const pipelineScore = Math.round(Math.min(99, idea.score * 0.6 + Math.min(40, guess.conversions * 20 + guess.clicks * 0.4)));
      scored.push({
        ideaId: idea._id,
        title: idea.title,
        kind,
        ideaScore: idea.score,
        pipelineScore,
        expectedClicks: Math.round(guess.clicks),
        expectedConversions: Math.round(guess.conversions * 10) / 10,
        basedOn: guess.confident ? `${guess.posts} of your posts about ${kind} work` : "the team average, because there are few posts yet",
      });
    }
    const summary = (map: Map<string, Outcome>) =>
      [...map.entries()]
        .map(([name, row]) => ({
          name,
          posts: row.posts,
          clicksPerPost: row.posts ? Math.round((row.clicks / row.posts) * 10) / 10 : 0,
          conversionsPerPost: row.posts ? Math.round((row.conversions / row.posts) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.conversionsPerPost - a.conversionsPerPost || b.clicksPerPost - a.clicksPerPost);
    return {
      totalPosts,
      learning: totalPosts < 10,
      ideas: scored.sort((a, b) => b.pipelineScore - a.pipelineScore).slice(0, 20),
      kinds: summary(byKind),
      roles: summary(byRole),
    };
  },
});

/** What the team shipped against what it told the world, by week and by person. */
export const shippedVsTold = query({
  args: { workspaceId: v.id("workspaces"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const days = Math.min(180, Math.max(7, args.days ?? 56));
    const since = Date.now() - days * DAY;
    const allMoments = (
      await ctx.db
        .query("moments")
        .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", args.workspaceId).gte("occurredAt", since))
        .collect()
    ).filter((moment) => moment.status === "active");
    const drafts = (
      await ctx.db
        .query("drafts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).filter((draft) => draft.channel !== "sample");
    const told = new Set(drafts.filter((draft) => draft.status === "posted" && draft.momentId).map((draft) => draft.momentId as string));
    // Older scans could save the same event twice. Count each event once, and keep the copy that was told.
    const moments = uniqueMoments(
      [...allMoments].sort((a, b) => Number(told.has(b._id)) - Number(told.has(a._id)) || b.occurredAt - a.occurredAt),
    );
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const weekStart = (time: number) => {
      const date = new Date(time);
      const day = (date.getUTCDay() + 6) % 7;
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - day);
      return date.toISOString().slice(0, 10);
    };
    const weeks = new Map<string, { shipped: number; told: number }>();
    for (let t = since; t <= Date.now(); t += 7 * DAY) weeks.set(weekStart(t), { shipped: 0, told: 0 });
    for (const moment of moments) {
      const row = weeks.get(weekStart(moment.occurredAt)) ?? { shipped: 0, told: 0 };
      row.shipped += 1;
      if (told.has(moment._id)) row.told += 1;
      weeks.set(weekStart(moment.occurredAt), row);
    }
    const people = new Map<string, { shipped: number; told: number }>();
    for (const moment of moments) {
      for (const name of moment.people.length ? moment.people : ["Unassigned"]) {
        const member = members.find((row) => row.name.toLowerCase().startsWith(name.toLowerCase()));
        const key = member?.name ?? name;
        const row = people.get(key) ?? { shipped: 0, told: 0 };
        row.shipped += 1;
        if (told.has(moment._id)) row.told += 1;
        people.set(key, row);
      }
    }
    const untold = moments
      .filter((moment) => !told.has(moment._id))
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 8)
      .map((moment) => ({ momentId: moment._id, title: moment.title, kind: moment.kind, occurredAt: moment.occurredAt, people: moment.people }));
    return {
      days,
      shipped: moments.length,
      told: moments.filter((moment) => told.has(moment._id)).length,
      weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, row]) => ({ week, ...row })),
      people: [...people.entries()].map(([name, row]) => ({ name, ...row })).sort((a, b) => b.shipped - a.shipped),
      untold,
    };
  },
});

export const auditLog = query({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const rows: Doc<"auditLog">[] = await ctx.db
      .query("auditLog")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(Math.min(500, args.limit ?? 200));
    return rows.map((row) => ({
      _id: row._id,
      at: row.at,
      actorType: row.actorType,
      actorName: row.actorName,
      action: row.action,
      target: row.target ?? null,
      detail: row.detail ?? null,
    }));
  },
});

/** Deletes raw source items older than each workspace's retention setting. */
export const applyRetention = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspaces = (await ctx.db.query("workspaces").collect()).filter((row) => row.retentionDays);
    for (const workspace of workspaces) {
      const cutoff = Date.now() - workspace.retentionDays! * DAY;
      const old = await ctx.db
        .query("sourceItems")
        .withIndex("by_workspace_created", (q) => q.eq("workspaceId", workspace._id).lt("createdAt", cutoff))
        .take(500);
      for (const row of old) await ctx.db.delete(row._id);
    }
  },
});
