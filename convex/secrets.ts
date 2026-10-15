import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMember, requireOwner } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { checkKey } from "./lib/providers";
import { provider } from "./schema";

export const listProviderKeys = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("kind", "provider"),
      )
      .collect();
    return rows.map((row) => ({
      provider: row.label,
      last4: row.last4,
      testedAt: row.testedAt ?? null,
      testOk: row.testOk ?? null,
      testMessage: row.testMessage ?? null,
    }));
  },
});

export const saveProviderKey = action({
  args: { workspaceId: v.id("workspaces"), provider, apiKey: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    await ctx.runQuery(internal.access.check, {
      workspaceId: args.workspaceId,
      role: "owner",
    });
    const apiKey = args.apiKey.trim();
    if (apiKey.length < 8) return { ok: false, message: "Paste the full key." };

    const check = await checkKey(args.provider, apiKey);
    if (!check.ok) return check;

    const sealed = await encrypt(apiKey);
    await ctx.runMutation(internal.secrets.upsertProviderKey, {
      workspaceId: args.workspaceId,
      provider: args.provider,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      last4: apiKey.slice(-4),
    });
    return { ok: true, message: "Key saved." };
  },
});

export const testProviderKey = action({
  args: { workspaceId: v.id("workspaces"), provider },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    await ctx.runQuery(internal.access.check, {
      workspaceId: args.workspaceId,
      role: "owner",
    });
    const sealed = await ctx.runQuery(internal.secrets.sealedProviderKey, args);
    if (!sealed) return { ok: false, message: "No key is saved for this provider." };
    const check = await checkKey(args.provider, await decrypt(sealed.ciphertext, sealed.iv));
    const message = check.ok ? "Key works." : check.message;
    await ctx.runMutation(internal.secrets.recordTest, {
      secretId: sealed._id,
      ok: check.ok,
      message,
    });
    return { ok: check.ok, message };
  },
});

export const listModels = action({
  args: { workspaceId: v.id("workspaces"), provider },
  handler: async (ctx, args): Promise<string[]> => {
    await ctx.runQuery(internal.access.check, {
      workspaceId: args.workspaceId,
      role: "owner",
    });
    const sealed = await ctx.runQuery(internal.secrets.sealedProviderKey, args);
    if (!sealed) return [];
    const check = await checkKey(args.provider, await decrypt(sealed.ciphertext, sealed.iv));
    if (!check.ok) throw new ConvexError(check.message);
    return check.models;
  },
});

export const removeProviderKey = mutation({
  args: { workspaceId: v.id("workspaces"), provider },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("kind", "provider"),
      )
      .collect();
    const target = rows.find((row) => row.label === args.provider);
    if (!target) return;
    await ctx.db.delete(target._id);

    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace?.defaultProvider === args.provider) {
      const next = rows.find((row) => row._id !== target._id);
      await ctx.db.patch(args.workspaceId, {
        defaultProvider: next ? (next.label as typeof args.provider) : undefined,
      });
    }
  },
});

export const setDefaultProvider = mutation({
  args: { workspaceId: v.id("workspaces"), provider },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const key = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("kind", "provider")
          .eq("label", args.provider),
      )
      .unique();
    if (!key) throw new ConvexError("Add a key for this provider first.");
    await ctx.db.patch(args.workspaceId, { defaultProvider: args.provider });
  },
});

export const sealedProviderKey = internalQuery({
  args: { workspaceId: v.id("workspaces"), provider },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("kind", "provider")
          .eq("label", args.provider),
      )
      .unique();
    return row ? { _id: row._id, ciphertext: row.ciphertext, iv: row.iv } : null;
  },
});

export const upsertProviderKey = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider,
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("kind", "provider")
          .eq("label", args.provider),
      )
      .unique();
    const fields = {
      ciphertext: args.ciphertext,
      iv: args.iv,
      last4: args.last4,
      testedAt: Date.now(),
      testOk: true,
      testMessage: "Key works.",
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("secrets", {
        workspaceId: args.workspaceId,
        kind: "provider",
        label: args.provider,
        ...fields,
      });
    }
    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace && !workspace.defaultProvider) {
      await ctx.db.patch(args.workspaceId, { defaultProvider: args.provider });
    }
  },
});

export const recordTest = internalMutation({
  args: { secretId: v.id("secrets"), ok: v.boolean(), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.secretId, {
      testedAt: Date.now(),
      testOk: args.ok,
      testMessage: args.message,
    });
  },
});
