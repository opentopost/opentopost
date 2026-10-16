import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery, query } from "./_generated/server";
import { isReviewer, requireMember, requireOwner } from "./lib/auth";
import { isMine, personalWeek, weekStart } from "./lib/personal";

/*
 * Personal and per-person views: "Your week" on each person's Home, the per-person table on
 * Team recap, and the data behind the Friday Slack recap each person gets.
 */

/** The signed-in person's week, plus how many drafts wait on them as a reviewer. */
export const myWeek = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.workspaceId);
    const week = await personalWeek(ctx, me);
    let toReview = 0;
    if (isReviewer(me.role)) {
      const pending = (
        await ctx.db
          .query("drafts")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .collect()
      ).filter((draft) => draft.reviewState === "pending" && draft.memberId !== me._id);
      toReview = pending.length;
    }
    return { ...week, toReview };
  },
});

/** One row per person: what they shipped and posted this week, the signups their posts brought, what waits on them, and what they have connected. */
export const team = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const slackConnected = Boolean(
      await ctx.db
        .query("sources")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.eq(q.field("type"), "slack"))
        .first(),
    );
    const start = weekStart();
    const moments = (
      await ctx.db
        .query("moments")
        .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", args.workspaceId).gte("occurredAt", start))
        .collect()
    ).filter((moment) => moment.status === "active");
    const rows = [];
    for (const member of members.filter((row) => !row.kindeUserId.startsWith("demo:"))) {
      const week = await personalWeek(ctx, member);
      const samples = await ctx.db
        .query("voiceSamples")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .collect();
      const profile = await ctx.db
        .query("voiceProfiles")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .unique();
      const voice = samples.filter((sample) => sample.status === "ready").length + (profile?.samplePosts?.length ?? 0);
      rows.push({
        memberId: member._id,
        name: member.name,
        role: member.role,
        shipped: moments.filter((moment) => isMine(moment, member)).length,
        posted: week.posted,
        clicks: week.last30.clicks,
        signups: week.last30.conversions,
        waiting: week.waiting.ready.length + week.waiting.sentBack.length,
        sentBack: week.waiting.sentBack.length,
        inReview: week.waiting.inReview,
        voice: voice >= 3,
        linkedin: Boolean(member.linkedin && member.linkedin.expiresAt > Date.now()),
        slack: slackConnected ? Boolean(member.slackUserId) : null,
        lastActiveAt: member.lastActiveAt ?? null,
      });
    }
    rows.sort((a, b) => b.shipped - a.shipped || b.posted - a.posted || a.name.localeCompare(b.name));
    return { weekOf: new Date(start).toISOString().slice(0, 10), timezone: workspace?.timezone ?? "UTC", rows };
  },
});

/** For the Friday Slack DMs. */
export const weekForMember = internalQuery({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const member = (await ctx.db.get(args.memberId)) as Doc<"members"> | null;
    if (!member) return null;
    return { member, week: await personalWeek(ctx, member) };
  },
});

export const membersOf = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("members")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    )
      .filter((member) => !member.kindeUserId.startsWith("demo:"))
      .map((member) => member._id),
});
