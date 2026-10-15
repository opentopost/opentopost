import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { entryFor } from "./hosted";
import { requireIdentity, requireMember, requireOwner } from "./lib/auth";
import { audit } from "./lib/ops";
import { deploymentMode, HOSTED } from "./lib/limits";
import { hostedProvider, entitlements, entitlementsFor, modelReady, teamOnly } from "./lib/plan";
import type { Provider, Task } from "./lib/providers";
import defaults from "./seed/modelDefaults.json";

function firstOrgCode(identity: Record<string, unknown>): string | undefined {
  const codes = identity.org_codes;
  return Array.isArray(codes) && typeof codes[0] === "string" ? codes[0] : undefined;
}

async function memberships(ctx: QueryCtx, subject: string) {
  const rows = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("kindeUserId", subject))
    .collect();
  return rows.sort((a, b) => (b.lastActiveAt ?? b._creationTime) - (a.lastActiveAt ?? a._creationTime));
}

export const ensure = mutation({
  args: { timezone: v.string(), accessCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await memberships(ctx, identity.subject);
    if (existing.length > 0) return existing[0].workspaceId;

    const entry = await entryFor(ctx, identity, args.accessCode);

    if ((await ctx.db.query("modelDefaults").first()) === null) {
      for (const row of defaults) {
        await ctx.db.insert("modelDefaults", {
          provider: row.provider as Provider,
          task: row.task as Task,
          modelId: row.modelId,
        });
      }
    }

    if (entry.joinWorkspaceId) {
      await ctx.db.insert("members", {
        workspaceId: entry.joinWorkspaceId,
        kindeUserId: identity.subject,
        role: "member",
        name: identity.name ?? identity.givenName ?? identity.email ?? "Member",
        email: identity.email,
        lastActiveAt: Date.now(),
      });
      await entry.onJoined();
      await ctx.scheduler.runAfter(0, internal.billing.syncSeats, { workspaceId: entry.joinWorkspaceId });
      return entry.joinWorkspaceId;
    }

    const first = identity.givenName ?? identity.name?.split(" ")[0];
    const workspaceId = await ctx.db.insert("workspaces", {
      name: entry.label ?? (first ? `${first}'s workspace` : "My workspace"),
      kindeOrgCode: firstOrgCode(identity),
      timezone: args.timezone,
      scanDay: 1,
    });
    await ctx.db.insert("members", {
      workspaceId,
      kindeUserId: identity.subject,
      role: "owner",
      name: identity.name ?? identity.givenName ?? identity.email ?? "Owner",
      email: identity.email,
      lastActiveAt: Date.now(),
    });
    await entry.onCreated(workspaceId);
    return workspaceId;
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const rows = await memberships(ctx, identity.subject);
    const member = rows[0];
    if (!member) return null;
    const workspace = await ctx.db.get(member.workspaceId);
    if (!workspace) return null;
    const all = await Promise.all(
      rows.map(async (row) => {
        const ws = await ctx.db.get(row.workspaceId);
        return ws ? { workspaceId: ws._id, name: ws.name, role: row.role } : null;
      }),
    );
    const ent = await entitlements(ctx, workspace);
    const { workspacesPerUser, membersPerWorkspace, sources, mcpServers } = ent.limits;
    const cap = (n: number) => (Number.isFinite(n) ? n : null);
    return {
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        defaultProvider: workspace.defaultProvider ?? null,
        timezone: workspace.timezone,
        scanDay: workspace.scanDay,
        reviewRequired: (workspace.reviewRequired ?? false) && ent.features.review,
        modelReady: modelReady(ent, workspace),
        hostedModels: ent.features.hostedModels && !workspace.useOwnKey,
        // Recordings and videos need Gemini; paid plans include it only when its key is set.
        hostedMedia: ent.features.hostedModels && !workspace.useOwnKey && hostedProvider(true) === "google",
        autopilot: workspace.autopilot ?? false,
        autoDraft: workspace.autoDraft !== false,
        postHour: workspace.postHour ?? 9,
        retentionDays: workspace.retentionDays ?? null,
      },
      plan: ent.plan,
      features: ent.features,
      member: {
        _id: member._id,
        name: member.name,
        email: member.email ?? null,
        role: member.role,
        timezone: member.timezone ?? null,
        postHour: member.postHour ?? null,
      },
      workspaces: all.filter((row): row is NonNullable<typeof row> => row !== null),
      mode: ent.mode,
      limits: {
        workspacesPerUser: cap(workspacesPerUser),
        membersPerWorkspace: cap(membersPerWorkspace),
        sources: cap(sources),
        mcpServers: cap(mcpServers),
      },
    };
  },
});

export const switchTo = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    await ctx.db.patch(member._id, { lastActiveAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    scanDay: v.optional(v.number()),
    timezone: v.optional(v.string()),
    reviewRequired: v.optional(v.boolean()),
    autopilot: v.optional(v.boolean()),
    autoDraft: v.optional(v.boolean()),
    postHour: v.optional(v.number()),
    retentionDays: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const patch: Partial<Doc<"workspaces">> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2 || name.length > 60) throw new ConvexError("Use a name between 2 and 60 characters.");
      patch.name = name;
    }
    if (args.scanDay !== undefined) {
      if (!Number.isInteger(args.scanDay) || args.scanDay < 0 || args.scanDay > 6) {
        throw new ConvexError("Choose a day of the week.");
      }
      patch.scanDay = args.scanDay;
    }
    if (args.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: args.timezone });
      } catch {
        throw new ConvexError("Choose a time zone from the list.");
      }
      patch.timezone = args.timezone;
    }
    if (args.reviewRequired !== undefined) {
      if (args.reviewRequired && !(await entitlementsFor(ctx, args.workspaceId)).features.review) {
        throw new ConvexError(teamOnly("review"));
      }
      patch.reviewRequired = args.reviewRequired;
    }
    if (args.autopilot !== undefined) patch.autopilot = args.autopilot;
    if (args.autoDraft !== undefined) patch.autoDraft = args.autoDraft;
    if (args.postHour !== undefined) {
      if (!Number.isInteger(args.postHour) || args.postHour < 0 || args.postHour > 23) throw new ConvexError("Choose an hour between 0 and 23.");
      patch.postHour = args.postHour;
    }
    if (args.retentionDays !== undefined) {
      if (args.retentionDays !== null && (!Number.isInteger(args.retentionDays) || args.retentionDays < 7 || args.retentionDays > 3650)) {
        throw new ConvexError("Keep source items for 7 to 3,650 days.");
      }
      patch.retentionDays = args.retentionDays ?? undefined;
    }
    await ctx.db.patch(args.workspaceId, patch);
    const changed = Object.keys(patch).filter((key) => key !== "name");
    if (changed.length || patch.name) {
      await audit(ctx, args.workspaceId, { member: owner, via: "app" }, "workspace.updated", undefined, Object.keys(patch).join(", "));
    }
  },
});

export const usage = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const mcp = await ctx.db
      .query("mcpServers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return { members: members.length, sources: sources.length, mcpServers: mcp.length };
  },
});

export const create = mutation({
  args: { name: v.string(), timezone: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const owned = (await memberships(ctx, identity.subject)).filter((row) => row.role === "owner");
    if (deploymentMode() === "hosted") {
      let free = 0;
      for (const row of owned) {
        const ws = await ctx.db.get(row.workspaceId);
        if (ws && (await entitlements(ctx, ws)).plan === "free") free += 1;
      }
      if (free >= HOSTED.workspacesPerUser) {
        throw new ConvexError("You already own a free workspace. Upgrade it in Settings > Billing, then create another.");
      }
    }
    const name = args.name.trim();
    if (name.length < 2 || name.length > 60) throw new ConvexError("Use a name between 2 and 60 characters.");
    const workspaceId = await ctx.db.insert("workspaces", { name, timezone: args.timezone, scanDay: 1 });
    await ctx.db.insert("members", {
      workspaceId,
      kindeUserId: identity.subject,
      role: "owner",
      name: identity.name ?? identity.givenName ?? identity.email ?? "Owner",
      email: identity.email,
      lastActiveAt: Date.now(),
    });
    return workspaceId;
  },
});
