import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";
import { audit } from "./lib/ops";

/*
 * API keys let agents and scripts act as one member of one workspace.
 * We store only a SHA-256 hash; the key is shown once when it is created.
 */

export const SCOPES = ["read", "draft", "publish", "admin"] as const;
export type Scope = (typeof SCOPES)[number];
export const SCOPE_NAMES: Record<Scope, string> = {
  read: "Read ideas, moments, drafts, and recaps",
  draft: "Claim ideas, write and revise drafts, add voice samples",
  publish: "Approve, schedule, and publish posts",
  admin: "Start scans and manage sources",
};

export async function hashKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const visible = rows.filter((row) => !row.revokedAt && (row.memberId === me._id || me.role === "owner" || me.role === "admin"));
    const names = new Map<string, string>();
    for (const row of visible) {
      if (!names.has(row.memberId)) names.set(row.memberId, (await ctx.db.get(row.memberId))?.name ?? "Former member");
    }
    return {
      scopes: SCOPES.map((scope) => ({ id: scope, name: SCOPE_NAMES[scope] })),
      keys: visible.map((row) => ({
        _id: row._id,
        name: row.name,
        prefix: row.prefix,
        scopes: row.scopes,
        owner: names.get(row.memberId) ?? "",
        mine: row.memberId === me._id,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt ?? null,
      })),
    };
  },
});

/** Creates a key for the signed-in member. Returns the key once. */
export const create = action({
  args: { workspaceId: v.id("workspaces"), name: v.string(), scopes: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ key: string }> => {
    const scopes = args.scopes.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
    if (scopes.length === 0) throw new ConvexError("Choose at least one permission.");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = `otp_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    await ctx.runMutation(internal.apiKeys.insert, {
      workspaceId: args.workspaceId,
      name: args.name.trim().slice(0, 60) || "API key",
      scopes,
      prefix: key.slice(0, 12),
      hash: await hashKey(key),
    });
    return { key };
  },
});

export const insert = internalMutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), scopes: v.array(v.string()), prefix: v.string(), hash: v.string() },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    if (args.scopes.includes("admin") && member.role !== "owner" && member.role !== "admin") {
      throw new ConvexError("Only owners and admins can create keys that manage the workspace.");
    }
    await ctx.db.insert("apiKeys", { ...args, memberId: member._id, createdAt: Date.now() });
    await audit(ctx, args.workspaceId, { member, via: "app" }, "api_key.created", args.name, args.scopes.join(", "));
  },
});

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.keyId);
    if (!row) return;
    const me = await requireMember(ctx, row.workspaceId);
    if (row.memberId !== me._id) await requireOwner(ctx, row.workspaceId);
    await ctx.db.patch(row._id, { revokedAt: Date.now() });
    await audit(ctx, row.workspaceId, { member: me, via: "app" }, "api_key.revoked", row.name);
  },
});

/** Resolves a bearer key to its member. Returns null for a missing or revoked key. */
export const resolve = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, args): Promise<{ key: Doc<"apiKeys">; member: Doc<"members"> } | null> => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("hash", args.hash))
      .unique();
    if (!key || key.revokedAt) return null;
    const member = await ctx.db.get(key.memberId);
    if (!member || member.workspaceId !== key.workspaceId) return null;
    return { key, member };
  },
});

export const touch = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    // Write at most once a minute, to keep busy agents cheap.
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt > 60_000) await ctx.db.patch(key._id, { lastUsedAt: Date.now() });
  },
});
