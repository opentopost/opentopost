import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { allowInDemo, isManager, requireMember } from "./lib/auth";
import { appActor, recordPosted, requireDraft } from "./drafts";
import { cancelSchedule, scheduleDraft } from "./lib/ops";
import { entitlementsFor } from "./lib/plan";
import { linkedinConfigured } from "./linkedin";


/** Schedules a draft. "publish" posts it to the author's LinkedIn. "remind" tells the author when it is time. */
export const set = mutation({
  args: { draftId: v.id("drafts"), at: v.number(), mode: v.union(v.literal("publish"), v.literal("remind")) },
  handler: async (ctx, args) => {
    allowInDemo(ctx);
    const draft = await requireDraft(ctx, args.draftId);
    const ent = await entitlementsFor(ctx, draft.workspaceId);
    await scheduleDraft(ctx, await appActor(ctx, draft.workspaceId), draft, {
      at: args.at,
      mode: args.mode,
      reviewFeature: ent.features.review,
      linkedinReady: linkedinConfigured(),
    });
  },
});

export const cancel = mutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await requireDraft(ctx, args.draftId);
    await cancelSchedule(ctx, await appActor(ctx, draft.workspaceId), draft);
  },
});

export const fireInput = internalQuery({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    const author = await ctx.db.get(draft.memberId);
    return { draft, email: author?.email ?? undefined };
  },
});

export const setState = internalMutation({
  args: {
    draftId: v.id("drafts"),
    state: v.union(v.literal("publishing"), v.literal("due")),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft?.schedule) return;
    await ctx.db.patch(draft._id, { schedule: { ...draft.schedule, state: args.state, jobId: undefined } });
  },
});

export const fire = internalAction({
  args: { draftId: v.id("drafts"), at: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const input = await ctx.runQuery(internal.schedule.fireInput, { draftId: args.draftId });
    const schedule = input?.draft.schedule;
    if (!input || !schedule || schedule.at !== args.at || schedule.state !== "scheduled") return;
    if (input.draft.status === "posted") return;
    if (schedule.mode === "publish") {
      await ctx.runMutation(internal.schedule.setState, { draftId: args.draftId, state: "publishing" });
      await ctx.runAction(internal.linkedin.publish, { draftId: args.draftId });
      return;
    }
    await ctx.runMutation(internal.schedule.setState, { draftId: args.draftId, state: "due" });
    try {
      await ctx.runAction(internal.slack.notifyDue, {
        workspaceId: input.draft.workspaceId,
        email: input.email,
        title: input.draft.title,
        draftId: args.draftId,
        company: input.draft.voice === "company",
      });
    } catch (error) {
      console.error("Slack reminder failed", error);
    }
  },
});

export const markPublished = internalMutation({
  args: { draftId: v.id("drafts"), url: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return;
    await recordPosted(ctx, draft, args.url);
    await ctx.db.patch(draft._id, {
      schedule: draft.schedule ? { ...draft.schedule, state: "published", jobId: undefined, error: undefined } : undefined,
    });
  },
});

export const markFailed = internalMutation({
  args: { draftId: v.id("drafts"), error: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft?.schedule) return;
    await ctx.db.patch(draft._id, { schedule: { ...draft.schedule, state: "failed", jobId: undefined, error: args.error.slice(0, 300) } });
  },
});

type CalendarItem = {
  draftId: Doc<"drafts">["_id"];
  title: string;
  hook: string;
  at: number;
  kind: "scheduled" | "posted";
  state: string;
  mode: string | null;
  company: boolean;
  authorName: string;
  mine: boolean;
  url: string | null;
  error: string | null;
};

/** Everything planned or posted in a time range, plus ready drafts that still need a slot. */
export const range = query({
  args: { workspaceId: v.id("workspaces"), from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.workspaceId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const names = new Map(members.map((member) => [member._id, member.name]));
    const visible = (draft: Doc<"drafts">) => draft.memberId === me._id || draft.voice === "company" || isManager(me.role);

    const scheduled = await ctx.db
      .query("drafts")
      .withIndex("by_workspace_scheduled", (q) => q.eq("workspaceId", args.workspaceId).gte("scheduledAt", args.from).lt("scheduledAt", args.to))
      .collect();
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_workspace_posted", (q) => q.eq("workspaceId", args.workspaceId).gte("postedAt", args.from).lt("postedAt", args.to))
      .collect();

    const items: CalendarItem[] = [];
    const seen = new Set<string>();
    for (const post of posts) {
      const draft = post.draftId ? await ctx.db.get(post.draftId) : null;
      if (draft && !visible(draft)) continue;
      if (!draft && post.memberId !== me._id && !isManager(me.role)) continue;
      if (draft) seen.add(draft._id);
      items.push({
        draftId: draft?._id ?? (post.draftId as Doc<"drafts">["_id"]),
        title: draft?.title ?? "Post",
        hook: draft?.hook ?? draft?.hooks[0] ?? "",
        at: post.postedAt,
        kind: "posted",
        state: "posted",
        mode: null,
        company: draft?.voice === "company",
        authorName: names.get(post.memberId) ?? "Former member",
        mine: post.memberId === me._id,
        url: post.linkedinUrl,
        error: null,
      });
    }
    for (const draft of scheduled) {
      if (!draft.schedule || seen.has(draft._id) || !visible(draft)) continue;
      items.push({
        draftId: draft._id,
        title: draft.title,
        hook: draft.hook ?? draft.hooks[0] ?? "",
        at: draft.schedule.at,
        kind: "scheduled",
        state: draft.schedule.state,
        mode: draft.schedule.mode,
        company: draft.voice === "company",
        authorName: names.get(draft.memberId) ?? "Former member",
        mine: draft.memberId === me._id,
        url: null,
        error: draft.schedule.error ?? null,
      });
    }

    const mine = await ctx.db
      .query("drafts")
      .withIndex("by_member", (q) => q.eq("memberId", me._id))
      .order("desc")
      .take(50);
    const company =
      isManager(me.role)
        ? (
            await ctx.db
              .query("drafts")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
              .collect()
          ).filter((draft) => draft.voice === "company" && draft.memberId !== me._id)
        : [];
    const unscheduled = [...mine, ...company]
      .filter((draft) => draft.status === "ready" && (!draft.schedule || draft.schedule.state === "failed"))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
      .map((draft) => ({
        draftId: draft._id,
        title: draft.title,
        company: draft.voice === "company",
        needsReview: draft.reviewState !== "approved",
      }));

    return {
      items: items.sort((a, b) => a.at - b.at),
      unscheduled,
    };
  },
});
