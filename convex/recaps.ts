import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { weekOf } from "./lib/week";
import { entitlements, entitlementsFor, teamOnly } from "./lib/plan";

const WEEK = 7 * 24 * 60 * 60 * 1000;
type ConversionType = Doc<"conversions">["type"];
const TYPES: ConversionType[] = ["signup", "demo", "application", "purchase"];

export type RecapStats = {
  posts: number;
  clicks: number;
  conversions: Record<ConversionType, number>;
  previous: { posts: number; clicks: number };
  people: { name: string; posts: number; conversions: number }[];
  top: { title: string; author: string; url: string; clicks: number; conversions: number }[];
};

async function countClicks(ctx: MutationCtx, linkId: Id<"trackedLinks">, from: number, to: number) {
  return (
    await ctx.db
      .query("linkClicks")
      .withIndex("by_link", (q) => q.eq("trackedLinkId", linkId).gte("at", from).lt("at", to))
      .collect()
  ).length;
}

export async function buildRecap(ctx: MutationCtx, workspaceId: Id<"workspaces">, week: string) {
  const from = Date.parse(`${week}T00:00:00Z`);
  const to = from + WEEK;
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const recentPosts = await ctx.db
    .query("posts")
    .withIndex("by_workspace_posted", (q) => q.eq("workspaceId", workspaceId).gte("postedAt", from - 12 * WEEK).lt("postedAt", to))
    .collect();
  const thisWeek = recentPosts.filter((post) => post.postedAt >= from);
  const lastWeek = recentPosts.filter((post) => post.postedAt >= from - WEEK && post.postedAt < from);

  const links = await ctx.db
    .query("trackedLinks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  let clicks = 0;
  let previousClicks = 0;
  const clicksByPost = new Map<Id<"posts">, number>();
  for (const link of links) {
    const now = await countClicks(ctx, link._id, from, to);
    clicks += now;
    previousClicks += await countClicks(ctx, link._id, from - WEEK, from);
    if (link.postId) clicksByPost.set(link.postId, (clicksByPost.get(link.postId) ?? 0) + now);
  }

  const conversionRows = await ctx.db
    .query("conversions")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId).gte("at", from).lt("at", to))
    .collect();
  const conversions = Object.fromEntries(TYPES.map((type) => [type, 0])) as Record<ConversionType, number>;
  const conversionsByPost = new Map<Id<"posts">, number>();
  const linkPost = new Map(links.map((link) => [link._id, link.postId]));
  for (const row of conversionRows) {
    conversions[row.type] += 1;
    const postId = row.trackedLinkId ? linkPost.get(row.trackedLinkId) : undefined;
    if (postId) conversionsByPost.set(postId, (conversionsByPost.get(postId) ?? 0) + 1);
  }

  const people = members
    .map((member) => {
      const mine = thisWeek.filter((post) => post.memberId === member._id);
      return {
        name: member.name,
        posts: mine.length,
        conversions: mine.reduce((sum, post) => sum + (conversionsByPost.get(post._id) ?? 0), 0),
      };
    })
    .sort((a, b) => b.conversions - a.conversions || b.posts - a.posts);

  const top = [];
  for (const post of thisWeek) {
    const draft = post.draftId ? await ctx.db.get(post.draftId) : null;
    const author = members.find((member) => member._id === post.memberId);
    top.push({
      _id: post._id,
      title: draft?.title ?? "Post",
      author: draft?.voice === "company" ? "Company page" : (author?.name ?? "Former member"),
      url: post.linkedinUrl,
      clicks: clicksByPost.get(post._id) ?? 0,
      conversions: conversionsByPost.get(post._id) ?? 0,
    });
  }
  top.sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);
  const best = top.slice(0, 3);

  const stats: RecapStats = {
    posts: thisWeek.length,
    clicks,
    conversions,
    previous: { posts: lastWeek.length, clicks: previousClicks },
    people,
    top: best.map((post) => ({ title: post.title, author: post.author, url: post.url, clicks: post.clicks, conversions: post.conversions })),
  };
  const totalConversions = TYPES.reduce((sum, type) => sum + conversions[type], 0);
  const summary =
    stats.posts === 0
      ? "No posts this week."
      : `${stats.posts} ${stats.posts === 1 ? "post" : "posts"}, ${clicks} link ${clicks === 1 ? "click" : "clicks"}, and ${totalConversions} ${totalConversions === 1 ? "conversion" : "conversions"}.`;

  const existing = await ctx.db
    .query("recaps")
    .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId).eq("weekOf", week))
    .unique();
  const fields = { stats, summary, topPostIds: best.map((post) => post._id), builtAt: Date.now() };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return ctx.db.insert("recaps", { workspaceId, weekOf: week, ...fields });
}

export const buildNow = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    if (!(await entitlementsFor(ctx, args.workspaceId)).features.recap) throw new ConvexError(teamOnly("recap"));
    await buildRecap(ctx, args.workspaceId, weekOf(Date.now()));
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const recaps = await ctx.db
      .query("recaps")
      .withIndex("by_workspace_week", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(52);
    return recaps.map((recap) => ({
      weekOf: recap.weekOf,
      summary: recap.summary,
      stats: recap.stats as RecapStats,
      builtAt: recap.builtAt ?? recap._creationTime,
    }));
  },
});

export const buildAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const week = weekOf(Date.now());
    const workspaces = await ctx.db.query("workspaces").collect();
    for (const workspace of workspaces) {
      // Everyone gets their own week in Slack, on every plan.
      await ctx.scheduler.runAfter(0, internal.slack.personalRecaps, { workspaceId: workspace._id });
      if (!(await entitlements(ctx, workspace)).features.recap) continue;
      const recapId = await buildRecap(ctx, workspace._id, week);
      await ctx.scheduler.runAfter(0, internal.slack.postRecap, { recapId });
    }
  },
});

export const forSlack = internalQuery({
  args: { recapId: v.id("recaps") },
  handler: async (ctx, args) => {
    const recap = await ctx.db.get(args.recapId);
    if (!recap) return null;
    return { workspaceId: recap.workspaceId, weekOf: recap.weekOf, summary: recap.summary, stats: recap.stats as RecapStats, sent: recap.sentToSlack ?? false };
  },
});

export const markSent = internalMutation({
  args: { recapId: v.id("recaps") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recapId, { sentToSlack: true });
  },
});
