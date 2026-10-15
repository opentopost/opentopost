import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { isManager, requireIdentity, requireMember, requireOwner } from "./lib/auth";
import { entitlementsFor } from "./lib/plan";
import { role } from "./schema";
import { deleteVoiceData } from "./voice";

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Your own posting time. Personal posts go out at this hour in this time zone. Null clears it back to the workspace default. */
export const setMySchedule = mutation({
  args: { workspaceId: v.id("workspaces"), timezone: v.union(v.string(), v.null()), postHour: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.workspaceId);
    if (args.timezone !== null && !validZone(args.timezone)) throw new ConvexError("Choose a time zone from the list.");
    if (args.postHour !== null && (!Number.isInteger(args.postHour) || args.postHour < 0 || args.postHour > 23))
      throw new ConvexError("Choose an hour from the list.");
    await ctx.db.patch(me._id, { timezone: args.timezone ?? undefined, postHour: args.postHour ?? undefined });
  },
});

async function ownerCount(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return members.filter((member) => member.role === "owner").length;
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.workspaceId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const invites = isManager(me.role)
      ? (
          await ctx.db
            .query("invites")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect()
        ).filter((invite) => !invite.acceptedBy && invite.expiresAt > Date.now())
      : [];
    return {
      members: members.map((member) => ({
        _id: member._id,
        name: member.name,
        email: member.email ?? null,
        role: member.role,
        joinedAt: member._creationTime,
        isMe: member._id === me._id,
      })),
      invites: invites.map((invite) => ({
        _id: invite._id,
        email: invite.email ?? null,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expiresAt,
      })),
    };
  },
});

export const createInvite = action({
  args: { workspaceId: v.id("workspaces"), email: v.optional(v.string()), role },
  handler: async (ctx, args): Promise<string> => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await ctx.runMutation(internal.members.insertInvite, { ...args, token });
    return token;
  },
});

export const insertInvite = internalMutation({
  args: { workspaceId: v.id("workspaces"), email: v.optional(v.string()), role, token: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    if (args.role === "owner" && owner.role !== "owner") throw new ConvexError("Only an owner can invite another owner.");
    const email = args.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Enter a valid email address.");
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (email && members.some((member) => member.email?.toLowerCase() === email)) {
      throw new ConvexError("This person is already a member.");
    }
    const pending = (
      await ctx.db
        .query("invites")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).filter((invite) => !invite.acceptedBy && invite.expiresAt > Date.now());
    const { limits, plan } = await entitlementsFor(ctx, args.workspaceId);
    if (members.length + pending.length >= limits.membersPerWorkspace) {
      throw new ConvexError(
        plan === "pro"
          ? "Pro is for one person. Move to Team in Settings > Billing to invite people."
          : `The free plan allows ${limits.membersPerWorkspace} members, including pending invites. Move to Team in Settings > Billing for more.`,
      );
    }
    await ctx.db.insert("invites", {
      workspaceId: args.workspaceId,
      token: args.token,
      email,
      role: args.role,
      createdBy: owner._id,
      expiresAt: Date.now() + INVITE_TTL,
    });
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return;
    await requireOwner(ctx, invite.workspaceId);
    await ctx.db.delete(invite._id);
  },
});

export const inviteInfo = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) return { status: "invalid" as const };
    const workspace = await ctx.db.get(invite.workspaceId);
    const inviter = await ctx.db.get(invite.createdBy);
    const existing = await ctx.db
      .query("members")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", invite.workspaceId).eq("kindeUserId", identity.subject))
      .unique();
    const base = { workspaceName: workspace?.name ?? "a workspace", inviter: inviter?.name ?? null, role: invite.role };
    if (existing) return { ...base, status: "member" as const };
    if (invite.acceptedBy) return { ...base, status: "used" as const };
    if (invite.expiresAt < Date.now()) return { ...base, status: "expired" as const };
    if (invite.email && invite.email !== identity.email?.toLowerCase()) {
      return { ...base, status: "wrong-email" as const, email: invite.email };
    }
    return { ...base, status: "valid" as const };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite || invite.acceptedBy || invite.expiresAt < Date.now()) {
      throw new ConvexError("This invite is no longer valid. Ask for a new one.");
    }
    if (invite.email && invite.email !== identity.email?.toLowerCase()) {
      throw new ConvexError(`This invite is for ${invite.email}. Sign in with that email.`);
    }
    const existing = await ctx.db
      .query("members")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", invite.workspaceId).eq("kindeUserId", identity.subject))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastActiveAt: Date.now() });
      return invite.workspaceId;
    }
    const memberId = await ctx.db.insert("members", {
      workspaceId: invite.workspaceId,
      kindeUserId: identity.subject,
      role: invite.role,
      name: identity.name ?? identity.givenName ?? identity.email ?? "Member",
      email: identity.email,
      lastActiveAt: Date.now(),
    });
    await ctx.db.patch(invite._id, { acceptedBy: memberId });
    await ctx.scheduler.runAfter(0, internal.billing.syncSeats, { workspaceId: invite.workspaceId });
    return invite.workspaceId;
  },
});

export const setRole = mutation({
  args: { memberId: v.id("members"), role },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return;
    const actor = await requireOwner(ctx, member.workspaceId);
    if ((member.role === "owner" || args.role === "owner") && actor.role !== "owner") {
      throw new ConvexError("Only an owner can make or change an owner.");
    }
    if (member.role === "owner" && args.role !== "owner" && (await ownerCount(ctx, member.workspaceId)) <= 1) {
      throw new ConvexError("Every workspace needs an owner. Make someone else an owner first.");
    }
    await ctx.db.patch(member._id, { role: args.role });
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return;
    const identity = await requireIdentity(ctx);
    const leaving = member.kindeUserId === identity.subject;
    if (!leaving) await requireOwner(ctx, member.workspaceId);
    if (member.role === "owner" && (await ownerCount(ctx, member.workspaceId)) <= 1) {
      throw new ConvexError(
        leaving ? "You are the only owner. Make someone else an owner, or delete the workspace." : "Every workspace needs an owner.",
      );
    }
    const profile = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .unique();
    if (profile) await ctx.db.delete(profile._id);
    await deleteVoiceData(ctx, member._id);
    await ctx.db.delete(member._id);
    await ctx.scheduler.runAfter(0, internal.billing.syncSeats, { workspaceId: member.workspaceId });
  },
});
