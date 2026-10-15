import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireIdentity, requireOwner, requirePrimaryOwner } from "./lib/auth";
import { kindeIssuer, m2mToken } from "./lib/kinde";
import { deleteVoiceData } from "./voice";

const BATCH = 200;

type Batch = (ctx: MutationCtx, workspaceId: Id<"workspaces">) => Promise<Id<never>[]>;

const ids = <T extends { _id: unknown }>(rows: T[]) => rows.map((row) => row._id as Id<never>);

const BATCHES: Batch[] = [
  async (ctx, id) => {
    const members = await ctx.db.query("members").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(50);
    const out: Id<never>[] = [];
    for (const member of members) {
      const profile = await ctx.db.query("voiceProfiles").withIndex("by_member", (q) => q.eq("memberId", member._id)).unique();
      if (profile) out.push(profile._id as Id<never>);
      const samples = await ctx.db.query("voiceSamples").withIndex("by_member", (q) => q.eq("memberId", member._id)).take(BATCH);
      for (const sample of samples) {
        if (sample.storageId) await ctx.storage.delete(sample.storageId);
        out.push(sample._id as Id<never>);
      }
      out.push(...ids(await ctx.db.query("voiceVersions").withIndex("by_member", (q) => q.eq("memberId", member._id)).take(BATCH)));
      if (samples.length < BATCH) out.push(member._id as Id<never>);
    }
    return out;
  },
  async (ctx, id) => {
    const samples = await ctx.db.query("voiceSamples").withIndex("by_company", (q) => q.eq("companyId", id)).take(BATCH);
    for (const sample of samples) if (sample.storageId) await ctx.storage.delete(sample.storageId);
    const versions = await ctx.db.query("voiceVersions").withIndex("by_company", (q) => q.eq("companyId", id)).take(BATCH);
    const profile = await ctx.db.query("voiceProfiles").withIndex("by_company", (q) => q.eq("companyId", id)).unique();
    return [...ids(samples), ...ids(versions), ...(profile ? [profile._id as Id<never>] : [])];
  },
  async (ctx, id) => ids(await ctx.db.query("sourceItems").withIndex("by_workspace_created", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("ideas").withIndex("by_workspace_week", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => {
    const drafts = await ctx.db.query("drafts").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH);
    for (const draft of drafts) for (const file of draft.media ?? []) await ctx.storage.delete(file.storageId);
    return ids(drafts);
  },
  async (ctx, id) => ids(await ctx.db.query("posts").withIndex("by_workspace_posted", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => {
    const links = await ctx.db.query("trackedLinks").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(20);
    const out: Id<never>[] = [];
    for (const link of links) {
      const clicks = await ctx.db.query("linkClicks").withIndex("by_link", (q) => q.eq("trackedLinkId", link._id)).take(BATCH);
      out.push(...ids(clicks));
      if (clicks.length < BATCH) out.push(link._id as Id<never>);
    }
    return out;
  },
  async (ctx, id) =>
    ids(await ctx.db.query("moments").withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) =>
    ids(await ctx.db.query("conversions").withIndex("by_workspace_at", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("sources").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("secrets").withIndex("by_workspace_kind", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) =>
    ids(await ctx.db.query("modelChoices").withIndex("by_workspace_provider_task", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("mcpServers").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("skills").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("recaps").withIndex("by_workspace_week", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) =>
    ids(await ctx.db.query("runs").withIndex("by_workspace_kind_started", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("invites").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("aiUsage").withIndex("by_workspace_month", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("billingIntents").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("teams").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("apiKeys").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("webhooks").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("auditLog").withIndex("by_workspace_at", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("draftEvents").withIndex("by_workspace_at", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("distributionAudits").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("crmConnections").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
  async (ctx, id) => ids(await ctx.db.query("planRequests").withIndex("by_workspace", (q) => q.eq("workspaceId", id)).take(BATCH)),
];

export const purgeWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    for (const batch of BATCHES) {
      const rows = await batch(ctx, args.workspaceId);
      if (rows.length === 0) continue;
      for (const id of rows) await ctx.db.delete(id);
      await ctx.scheduler.runAfter(0, internal.account.purgeWorkspace, args);
      return;
    }
    if (await ctx.db.get(args.workspaceId)) await ctx.db.delete(args.workspaceId);
  },
});

export const deleteWorkspace = mutation({
  args: { workspaceId: v.id("workspaces"), confirmName: v.string() },
  handler: async (ctx, args) => {
    await requirePrimaryOwner(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return;
    if (args.confirmName.trim() !== workspace.name) throw new ConvexError("Type the workspace name exactly to confirm.");
    await ctx.db.patch(workspace._id, { name: `${workspace.name} (deleting)` });
    await ctx.scheduler.runAfter(0, internal.account.purgeWorkspace, { workspaceId: workspace._id });
  },
});

export const plan = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("kindeUserId", identity.subject))
      .collect();
    const steps: { memberId: Id<"members">; workspaceId: Id<"workspaces">; purge: boolean; name: string }[] = [];
    for (const row of rows) {
      const others = (
        await ctx.db
          .query("members")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
          .collect()
      ).filter((member) => member._id !== row._id);
      const workspace = await ctx.db.get(row.workspaceId);
      const name = workspace?.name ?? "a workspace";
      if (others.length === 0) {
        steps.push({ memberId: row._id, workspaceId: row.workspaceId, purge: true, name });
      } else if (row.role === "owner" && !others.some((member) => member.role === "owner")) {
        throw new ConvexError(`Make someone else an owner of ${name} first, or remove its other members.`);
      } else {
        steps.push({ memberId: row._id, workspaceId: row.workspaceId, purge: false, name });
      }
    }
    return { subject: identity.subject, steps };
  },
});

export const applyDeletion = internalMutation({
  args: {
    steps: v.array(
      v.object({ memberId: v.id("members"), workspaceId: v.id("workspaces"), purge: v.boolean(), name: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    for (const step of args.steps) {
      if (step.purge) {
        await ctx.scheduler.runAfter(0, internal.account.purgeWorkspace, { workspaceId: step.workspaceId });
        continue;
      }
      const profile = await ctx.db
        .query("voiceProfiles")
        .withIndex("by_member", (q) => q.eq("memberId", step.memberId))
        .unique();
      if (profile) await ctx.db.delete(profile._id);
      await deleteVoiceData(ctx, step.memberId);
      await ctx.db.delete(step.memberId);
    }
  },
});

async function deleteKindeUser(subject: string): Promise<boolean> {
  const token = await m2mToken();
  if (!token) return false;
  const response = await fetch(`${kindeIssuer()}/api/v1/user?id=${encodeURIComponent(subject)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

export const deleteAccount = action({
  args: { confirm: v.string() },
  handler: async (ctx, args): Promise<{ signInDeleted: boolean }> => {
    if (args.confirm.trim().toLowerCase() !== "delete my account") {
      throw new ConvexError('Type "delete my account" to confirm.');
    }
    const plan = await ctx.runQuery(internal.account.plan, {});
    await ctx.runMutation(internal.account.applyDeletion, { steps: plan.steps });
    return { signInDeleted: await deleteKindeUser(plan.subject) };
  },
});

export const exportWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    const members = await ctx.db.query("members").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    const notes = await ctx.db.query("sourceItems").withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId)).take(2000);
    const ideas = await ctx.db.query("ideas").withIndex("by_workspace_week", (q) => q.eq("workspaceId", args.workspaceId)).take(2000);
    const drafts = await ctx.db.query("drafts").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(2000);
    const posts = await ctx.db.query("posts").withIndex("by_workspace_posted", (q) => q.eq("workspaceId", args.workspaceId)).take(2000);
    const name = new Map(members.map((member) => [member._id, member.name]));
    return {
      exportedAt: new Date().toISOString(),
      workspace: { name: workspace?.name, timezone: workspace?.timezone },
      members: members.map((member) => ({ name: member.name, email: member.email, role: member.role })),
      notes: notes.map((note) => ({ title: note.title, text: note.text, url: note.url, author: note.author, createdAt: note.createdAt })),
      ideas: ideas.map((idea) => ({ title: idea.title, angle: idea.angle, score: idea.score, status: idea.status, week: idea.weekOf })),
      drafts: drafts.map((draft) => ({
        title: draft.title,
        author: name.get(draft.memberId),
        hook: draft.hook,
        body: draft.body,
        status: draft.status,
      })),
      posts: posts.map((post) => ({ author: name.get(post.memberId), url: post.linkedinUrl, postedAt: post.postedAt })),
    };
  },
});
