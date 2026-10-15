import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const provider = v.union(v.literal("github"), v.literal("linkedin"));

/** One-time state for an OAuth or app-install redirect. Expires after ten minutes. */
export const saveState = internalMutation({
  args: { provider, state: v.string(), workspaceId: v.id("workspaces"), memberId: v.id("members") },
  handler: async (ctx, args) => {
    await ctx.db.insert("slackStates", { ...args, expiresAt: Date.now() + 10 * 60 * 1000 });
  },
});

export const consumeState = internalMutation({
  args: { provider, state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("slackStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row || row.provider !== args.provider) return null;
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) return null;
    return { workspaceId: row.workspaceId, memberId: row.memberId };
  },
});

export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
