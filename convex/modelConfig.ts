import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import defaults from "./seed/modelDefaults.json";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMember, requireOwner } from "./lib/auth";
import { PROVIDERS, TASKS, type Provider, type Task } from "./lib/providers";
import { entitlements, hostedProvider, monthOf } from "./lib/plan";
import { provider, task } from "./schema";

async function modelFor(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  providerName: Provider,
  taskName: Task,
): Promise<{ modelId: string; source: "workspace" | "default" } | null> {
  const choice = await ctx.db
    .query("modelChoices")
    .withIndex("by_workspace_provider_task", (q) =>
      q.eq("workspaceId", workspaceId).eq("provider", providerName).eq("task", taskName),
    )
    .unique();
  if (choice) return { modelId: choice.modelId, source: "workspace" };
  const fallback = await ctx.db
    .query("modelDefaults")
    .withIndex("by_provider_task", (q) =>
      q.eq("provider", providerName).eq("task", taskName),
    )
    .unique();
  return fallback ? { modelId: fallback.modelId, source: "default" } : null;
}

export const forWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows = [];
    for (const providerName of PROVIDERS) {
      for (const taskName of TASKS) {
        const model = await modelFor(ctx, args.workspaceId, providerName, taskName);
        rows.push({
          provider: providerName,
          task: taskName,
          modelId: model?.modelId ?? null,
          source: model?.source ?? null,
        });
      }
    }
    return rows;
  },
});

export const setModel = mutation({
  args: { workspaceId: v.id("workspaces"), provider, task, modelId: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const modelId = args.modelId.trim();
    if (!modelId) throw new ConvexError("Choose a model.");
    const existing = await ctx.db
      .query("modelChoices")
      .withIndex("by_workspace_provider_task", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("provider", args.provider)
          .eq("task", args.task),
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, { modelId });
    else await ctx.db.insert("modelChoices", { ...args, modelId });
  },
});

export const resolve = internalQuery({
  args: { workspaceId: v.id("workspaces"), task, media: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new ConvexError("Workspace not found.");
    if (workspace.demo) throw new ConvexError("The demo workspace does not call a model.");
    const ent = await entitlements(ctx, workspace);

    if (ent.features.hostedModels && !workspace.useOwnKey) {
      const usage = await ctx.db
        .query("aiUsage")
        .withIndex("by_workspace_month", (q) => q.eq("workspaceId", args.workspaceId).eq("month", monthOf()))
        .unique();
      if (ent.aiCallsPerMonth !== null && (usage?.calls ?? 0) >= ent.aiCallsPerMonth) {
        throw new ConvexError(
          "You have used this month's included AI. Add your own key in Settings > Model, or wait until next month.",
        );
      }
      const hostedName = hostedProvider(args.media ?? false);
      const hosted = hostedName
        ? await ctx.db
            .query("modelDefaults")
            .withIndex("by_provider_task", (q) => q.eq("provider", hostedName).eq("task", args.task))
            .unique()
        : null;
      if (hostedName && hosted) {
        return { provider: hostedName, modelId: hosted.modelId, hosted: true as const };
      }
    }

    const providerName = workspace.defaultProvider;
    if (!providerName) throw new ConvexError("Add a model key in settings first.");
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("kind", "provider")
          .eq("label", providerName),
      )
      .unique();
    if (!secret) throw new ConvexError("Add a model key in settings first.");
    const model = await modelFor(ctx, args.workspaceId, providerName, args.task);
    if (!model) {
      throw new ConvexError(`Choose a ${args.task} model for ${providerName} in settings.`);
    }
    return {
      provider: providerName,
      modelId: model.modelId,
      hosted: false as const,
      ciphertext: secret.ciphertext,
      iv: secret.iv,
    };
  },
});

/** Brings the default models in the database up to date with seed/modelDefaults.json. Run after changing the file. */
export const syncDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    const changed: string[] = [];
    for (const row of defaults) {
      const existing = await ctx.db
        .query("modelDefaults")
        .withIndex("by_provider_task", (q) => q.eq("provider", row.provider as Provider).eq("task", row.task as Task))
        .unique();
      if (existing?.modelId === row.modelId) continue;
      if (existing) await ctx.db.patch(existing._id, { modelId: row.modelId });
      else await ctx.db.insert("modelDefaults", { provider: row.provider as Provider, task: row.task as Task, modelId: row.modelId });
      changed.push(`${row.provider} ${row.task}: ${row.modelId}`);
    }
    return changed;
  },
});
