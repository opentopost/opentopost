import { uniqueMoments } from "./lib/dedupe";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { appActor } from "./drafts";
import { draftFromMoment } from "./lib/ops";
import { channel } from "./schema";

export const list = query({
  args: { workspaceId: v.id("workspaces"), archived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const moments = await ctx.db
      .query("moments")
      .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(200);
    const matching = moments.filter((moment) => (args.archived ? moment.status === "archived" : moment.status === "active"));
    // Older scans could save the same event twice. Show each event once.
    const wanted = args.archived ? matching : uniqueMoments(matching);
    const rows = [];
    for (const moment of wanted) {
      const items = await Promise.all(moment.sourceItemIds.map((id) => ctx.db.get(id)));
      const byId = new Map(
        items.filter((item): item is Doc<"sourceItems"> => item !== null).map((item) => [item._id as Id<"sourceItems">, item]),
      );
      const drafts = await ctx.db
        .query("drafts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.eq(q.field("momentId"), moment._id))
        .collect();
      rows.push({
        _id: moment._id,
        title: moment.title,
        summary: moment.summary,
        kind: moment.kind,
        people: moment.people,
        occurredAt: moment.occurredAt,
        outputs: drafts.length,
        facts: moment.facts.map((fact) => {
          const item = fact.sourceItemId ? byId.get(fact.sourceItemId) : undefined;
          return {
            id: fact.id,
            text: fact.text,
            quote: fact.quote ?? null,
            source: item ? { title: item.title ?? null, url: item.url ?? null, author: item.author ?? null } : null,
          };
        }),
      });
    }
    return rows;
  },
});

export const setArchived = mutation({
  args: { momentId: v.id("moments"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const moment = await ctx.db.get(args.momentId);
    if (!moment) return;
    await requireMember(ctx, moment.workspaceId);
    await ctx.db.patch(moment._id, { status: args.archived ? "archived" : "active" });
  },
});

export const draft = mutation({
  args: { momentId: v.id("moments"), channel, company: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Id<"drafts">> => {
    const moment = await ctx.db.get(args.momentId);
    if (!moment) throw new ConvexError("This moment no longer exists.");
    const actor = await appActor(ctx, moment.workspaceId);
    return draftFromMoment(ctx, actor, moment._id, args.channel, Boolean(args.company));
  },
});
