import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { isManager, requireIdentity, requireMember, requireOwner } from "./lib/auth";
import { emit } from "./lib/ops";
import { conversionType } from "./schema";
import { entitlements, entitlementsFor, teamOnly } from "./lib/plan";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomString(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export const forDraft = query({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return [];
    await requireMember(ctx, draft.workspaceId);
    const links = await ctx.db
      .query("trackedLinks")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    const rows = [];
    for (const link of links) {
      const conversions = await ctx.db
        .query("conversions")
        .withIndex("by_link", (q) => q.eq("trackedLinkId", link._id))
        .collect();
      rows.push({
        _id: link._id,
        slug: link.slug,
        targetUrl: link.targetUrl,
        clicks: link.clicks ?? 0,
        conversions: conversions.length,
      });
    }
    return rows;
  },
});

export const create = action({
  args: { draftId: v.id("drafts"), url: v.string() },
  handler: async (ctx, args): Promise<{ slug: string; targetUrl: string }> => {
    let target: URL;
    try {
      target = new URL(args.url.trim());
    } catch {
      throw new ConvexError("Enter a full link, starting with https://");
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new ConvexError("Only web links can be tracked.");
    const slug = randomString(7);
    await ctx.runMutation(internal.links.insert, { draftId: args.draftId, slug, targetUrl: target.toString() });
    return { slug, targetUrl: target.toString() };
  },
});

export const insert = internalMutation({
  args: { draftId: v.id("drafts"), slug: v.string(), targetUrl: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new ConvexError("This draft no longer exists.");
    const author = await ctx.db.get(draft.memberId);
    if (author?.kindeUserId !== identity.subject) throw new ConvexError("You can only add links to your own drafts.");
    const post = await ctx.db
      .query("posts")
      .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
      .first();
    await ctx.db.insert("trackedLinks", {
      workspaceId: draft.workspaceId,
      draftId: draft._id,
      memberId: draft.memberId,
      postId: post?._id,
      slug: args.slug,
      targetUrl: args.targetUrl,
      clicks: 0,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { linkId: v.id("trackedLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) return;
    const member = await requireMember(ctx, link.workspaceId);
    if (link.memberId !== member._id && !isManager(member.role)) throw new ConvexError("You can only remove your own links.");
    await ctx.db.delete(link._id);
  },
});

export const recordClick = mutation({
  args: { slug: v.string(), referrer: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string | null> => {
    const link = await ctx.db
      .query("trackedLinks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!link) return null;
    await ctx.db.insert("linkClicks", {
      trackedLinkId: link._id,
      at: Date.now(),
      referrer: args.referrer?.slice(0, 300),
    });
    await ctx.db.patch(link._id, { clicks: (link.clicks ?? 0) + 1 });
    const target = new URL(link.targetUrl);
    if (!target.searchParams.has("utm_source")) target.searchParams.set("utm_source", "linkedin");
    if (!target.searchParams.has("utm_medium")) target.searchParams.set("utm_medium", "social");
    if (!target.searchParams.has("utm_campaign")) target.searchParams.set("utm_campaign", "opentopost");
    target.searchParams.set("utm_content", link.slug);
    return target.toString();
  },
});

export const recordConversion = mutation({
  args: { key: v.string(), ref: v.optional(v.string()), type: conversionType },
  handler: async (ctx, args): Promise<boolean> => {
    if (args.key.length < 20) return false;
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_conversion_key", (q) => q.eq("conversionKey", args.key))
      .first();
    if (!workspace) return false;
    if (!(await entitlements(ctx, workspace)).features.conversions) return false;
    let trackedLinkId: Id<"trackedLinks"> | undefined;
    if (args.ref) {
      const link = await ctx.db
        .query("trackedLinks")
        .withIndex("by_slug", (q) => q.eq("slug", args.ref!))
        .unique();
      if (link && link.workspaceId === workspace._id) trackedLinkId = link._id;
    }
    await ctx.db.insert("conversions", { workspaceId: workspace._id, trackedLinkId, type: args.type, at: Date.now(), source: "api" });
    await emit(ctx, workspace._id, "conversion.created", { type: args.type, source: "api", slug: args.ref ?? null });
    return true;
  },
});

export const conversionKey = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace?.conversionKey ?? null;
  },
});

export const rotateConversionKey = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.links.setConversionKey, { workspaceId: args.workspaceId, key: `otp_${randomString(32)}` });
  },
});

export const setConversionKey = internalMutation({
  args: { workspaceId: v.id("workspaces"), key: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    if (!(await entitlementsFor(ctx, args.workspaceId)).features.conversions) throw new ConvexError(teamOnly("conversions"));
    await ctx.db.patch(args.workspaceId, { conversionKey: args.key });
  },
});
