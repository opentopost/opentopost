import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { weekOf } from "./week";

const DAY = 24 * 60 * 60 * 1000;

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when one of a moment's people is this member, by name, first name, or email name. */
export function isMine(moment: Doc<"moments">, member: Doc<"members">) {
  const full = clean(member.name);
  const first = clean(member.name.split(/\s+/)[0] ?? "");
  const handle = clean((member.email ?? "").split("@")[0] ?? "");
  return moment.people.some((person) => {
    const p = clean(person);
    if (p.length < 3) return false;
    return p === full || p === handle || full.startsWith(p) || (first.length >= 3 && (p === first || p.startsWith(first)));
  });
}

export function weekStart(now = Date.now()) {
  return Date.parse(`${weekOf(now)}T00:00:00Z`);
}

/** One person's week: what they shipped, what they posted, how posts did, and what is waiting on them. */
export async function personalWeek(ctx: QueryCtx, member: Doc<"members">, now = Date.now()) {
  const start = weekStart(now);
  const recent = (
    await ctx.db
      .query("moments")
      .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", member.workspaceId).gte("occurredAt", now - 14 * DAY))
      .collect()
  ).filter((moment) => moment.status === "active" && isMine(moment, member));
  const drafts = await ctx.db
    .query("drafts")
    .withIndex("by_member", (q) => q.eq("memberId", member._id))
    .order("desc")
    .take(200);
  const personal = drafts.filter((draft) => draft.voice !== "company" && draft.channel !== "sample");
  const touched = new Set(personal.filter((draft) => draft.momentId).map((draft) => draft.momentId as string));
  const toldIds = new Set(personal.filter((draft) => draft.status === "posted" && draft.momentId).map((draft) => draft.momentId as string));
  const shippedThisWeek = recent.filter((moment) => moment.occurredAt >= start);

  const posts = (
    await ctx.db
      .query("posts")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect()
  ).filter((post) => post.postedAt >= now - 30 * DAY);
  const links = (
    await ctx.db
      .query("trackedLinks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", member.workspaceId))
      .collect()
  ).filter((link) => link.memberId === member._id);
  let conversions = 0;
  for (const link of links) {
    conversions += (
      await ctx.db
        .query("conversions")
        .withIndex("by_link", (q) => q.eq("trackedLinkId", link._id))
        .collect()
    ).filter((row) => row.at >= now - 30 * DAY).length;
  }

  const upcoming = personal
    .filter((draft) => draft.status !== "posted" && draft.schedule && draft.schedule.at > now && draft.schedule.state !== "failed" && draft.schedule.state !== "published")
    .sort((a, b) => (a.schedule?.at ?? 0) - (b.schedule?.at ?? 0));
  const reviewerIds = personal.map((draft) => draft.review?.reviewerId).filter((id): id is Id<"members"> => Boolean(id));
  const reviewers = new Map((await Promise.all([...new Set(reviewerIds)].map((id) => ctx.db.get(id)))).filter((m): m is Doc<"members"> => m !== null).map((m) => [m._id as string, m.name]));

  return {
    weekOf: weekOf(now),
    shipped: shippedThisWeek.length,
    toldThisWeek: shippedThisWeek.filter((moment) => toldIds.has(moment._id)).length,
    posted: posts.filter((post) => post.postedAt >= start).length,
    last30: { posts: posts.length, clicks: links.reduce((sum, link) => sum + (link.clicks ?? 0), 0), conversions },
    untold: recent
      .filter((moment) => !touched.has(moment._id))
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 3)
      .map((moment) => ({ momentId: moment._id, title: moment.title, occurredAt: moment.occurredAt })),
    waiting: {
      ready: personal
        .filter((draft) => draft.status === "ready" && !draft.schedule && draft.reviewState !== "pending" && draft.reviewState !== "changes_requested")
        .slice(0, 5)
        .map((draft) => ({ _id: draft._id, title: draft.title, approved: draft.reviewState === "approved" })),
      sentBack: personal
        .filter((draft) => draft.status === "ready" && draft.reviewState === "changes_requested")
        .slice(0, 5)
        .map((draft) => ({
          _id: draft._id,
          title: draft.title,
          comment: draft.review?.comment ?? null,
          reviewer: draft.review?.reviewerId ? (reviewers.get(draft.review.reviewerId) ?? null) : null,
        })),
      inReview: personal.filter((draft) => draft.reviewState === "pending").length,
      next: upcoming[0] ? { _id: upcoming[0]._id, title: upcoming[0].title, at: upcoming[0].schedule!.at } : null,
      scheduled: upcoming.length,
    },
  };
}
