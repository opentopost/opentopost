import { ConvexError, v } from "convex/values";
import { queueFirstScan } from "./lib/firstScan";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { entitlementsFor } from "./lib/plan";

export function sourceLimitMessage(plan: string, max: number): string {
  return plan === "team"
    ? `Your plan allows ${max} sources. Remove one to add another.`
    : `Your plan allows ${max} sources. Upgrade in Settings > Billing for more.`;
}

/** Sources that count toward the plan's source limit. MCP servers have their own limit. */
export async function countedSources(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return sources.filter((source) => source.type !== "mcp").length;
}

export const saveItems = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    items: v.array(
      v.object({
        externalId: v.string(),
        title: v.string(),
        text: v.string(),
        author: v.string(),
        url: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      const existing = await ctx.db
        .query("sourceItems")
        .withIndex("by_source_external", (q) => q.eq("sourceId", args.sourceId).eq("externalId", item.externalId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, { text: item.text, title: item.title });
      else await ctx.db.insert("sourceItems", { workspaceId: args.workspaceId, sourceId: args.sourceId, ...item });
    }
  },
});

async function notesSource(ctx: MutationCtx, workspaceId: Id<"workspaces">): Promise<Id<"sources">> {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const existing = sources.find((source) => source.type === "notes");
  if (existing) return existing._id;
  const { limits, plan } = await entitlementsFor(ctx, workspaceId);
  if (sources.filter((source) => source.type !== "mcp").length >= limits.sources) {
    throw new ConvexError(sourceLimitMessage(plan, limits.sources));
  }
  const created = await ctx.db.insert("sources", {
    workspaceId,
    type: "notes",
    config: { name: "Notes" },
    enabled: true,
  });
  await queueFirstScan(ctx, workspaceId);
  return created;
}

export const overview = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const notes = sources.find((source) => source.type === "notes");
    const items = notes
      ? await ctx.db
          .query("sourceItems")
          .withIndex("by_source_created", (q) => q.eq("sourceId", notes._id))
          .order("desc")
          .take(100)
      : [];
    return {
      sourceCount: sources.length,
      notes: items.map((item) => ({
        _id: item._id,
        title: item.title ?? null,
        text: item.text,
        url: item.url ?? null,
        author: item.author ?? null,
        createdAt: item.createdAt,
      })),
      lastScannedAt: notes?.lastScannedAt ?? null,
    };
  },
});

export const addNote = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    text: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const text = args.text.trim();
    if (text.length < 30) throw new ConvexError("Add a bit more detail. Short notes rarely become good posts.");
    if (text.length > 20000) throw new ConvexError("Keep each note under 20,000 characters. Split longer notes.");
    let url: string | undefined;
    if (args.url?.trim()) {
      try {
        url = new URL(args.url.trim()).toString();
      } catch {
        throw new ConvexError("The link is not a valid URL.");
      }
    }
    const sourceId = await notesSource(ctx, args.workspaceId);
    await ctx.db.insert("sourceItems", {
      workspaceId: args.workspaceId,
      sourceId,
      externalId: `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: args.title?.trim() || undefined,
      text,
      url,
      author: member.name,
      createdAt: Date.now(),
    });
  },
});

export const removeNote = mutation({
  args: { workspaceId: v.id("workspaces"), itemId: v.id("sourceItems") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.workspaceId !== args.workspaceId) return;
    await ctx.db.delete(item._id);
  },
});
