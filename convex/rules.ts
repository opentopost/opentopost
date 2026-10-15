import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";
import { entitlementsFor, teamOnly } from "./lib/plan";

const scope = v.union(v.literal("ideas"), v.literal("draft"));
const MAX_RULES = 30;
const MAX_BODY = 4000;

export async function activeRules(ctx: QueryCtx, workspaceId: Id<"workspaces">, which: "ideas" | "draft") {
  if (!(await entitlementsFor(ctx, workspaceId)).features.rules) return [];
  const rules = await ctx.db
    .query("skills")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return rules
    .filter((rule) => rule.enabled && rule.scopes.includes(which))
    .map((rule) => ({ name: rule.name, body: rule.body }));
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rules = await ctx.db
      .query("skills")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rules
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((rule) => ({
        _id: rule._id,
        name: rule.name,
        description: rule.description,
        body: rule.body,
        enabled: rule.enabled,
        scopes: rule.scopes,
        updatedAt: rule.updatedAt ?? rule._creationTime,
      }));
  },
});

export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ruleId: v.optional(v.id("skills")),
    name: v.string(),
    description: v.string(),
    body: v.string(),
    scopes: v.array(scope),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    if (!(await entitlementsFor(ctx, args.workspaceId)).features.rules) throw new ConvexError(teamOnly("rules"));
    const name = args.name.trim();
    const body = args.body.trim();
    if (name.length < 2 || name.length > 60) throw new ConvexError("Use a name between 2 and 60 characters.");
    if (!body) throw new ConvexError("Write the rule.");
    if (body.length > MAX_BODY) throw new ConvexError("Keep each rule under 4,000 characters.");
    if (args.scopes.length === 0) throw new ConvexError("Choose where the rule applies.");
    const fields = {
      name,
      description: args.description.trim().slice(0, 200),
      body,
      scopes: [...new Set(args.scopes)],
      enabled: args.enabled,
      updatedAt: Date.now(),
    };
    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId);
      if (!rule || rule.workspaceId !== args.workspaceId) throw new ConvexError("This rule no longer exists.");
      await ctx.db.patch(rule._id, fields);
      return rule._id;
    }
    const count = (
      await ctx.db
        .query("skills")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).length;
    if (count >= MAX_RULES) throw new ConvexError(`A workspace can have ${MAX_RULES} rules.`);
    return ctx.db.insert("skills", { workspaceId: args.workspaceId, ...fields });
  },
});

export const setEnabled = mutation({
  args: { ruleId: v.id("skills"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) return;
    await requireOwner(ctx, rule.workspaceId);
    if (args.enabled && !(await entitlementsFor(ctx, rule.workspaceId)).features.rules) {
      throw new ConvexError(teamOnly("rules"));
    }
    await ctx.db.patch(rule._id, { enabled: args.enabled, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { ruleId: v.id("skills") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) return;
    await requireOwner(ctx, rule.workspaceId);
    await ctx.db.delete(rule._id);
  },
});
