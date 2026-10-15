import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function requireIdentity(ctx: Ctx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in to continue.");
  return identity;
}

export async function requireMember(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"members">> {
  const identity = await requireIdentity(ctx);
  const member = await ctx.db
    .query("members")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("kindeUserId", identity.subject),
    )
    .unique();
  if (!member) throw new ConvexError("You are not a member of this workspace.");
  return member;
}

export type Role = Doc<"members">["role"];

/** Owners and admins manage the workspace: sources, rules, members, settings. */
export const isManager = (role: Role) => role === "owner" || role === "admin";
/** Owners, admins, and reviewers can approve drafts. */
export const isReviewer = (role: Role) => isManager(role) || role === "reviewer";

/** An owner or an admin. Billing and deleting the workspace use requirePrimaryOwner. */
export async function requireOwner(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"members">> {
  const member = await requireMember(ctx, workspaceId);
  if (!isManager(member.role)) {
    throw new ConvexError("Only a workspace owner or admin can do this.");
  }
  return member;
}

/** Only an owner: billing, deleting the workspace, and making other owners. */
export async function requirePrimaryOwner(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"members">> {
  const member = await requireMember(ctx, workspaceId);
  if (member.role !== "owner") throw new ConvexError("Only a workspace owner can do this.");
  return member;
}

export async function requireReviewer(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"members">> {
  const member = await requireMember(ctx, workspaceId);
  if (!isReviewer(member.role)) throw new ConvexError("Only owners, admins, and reviewers can review drafts.");
  return member;
}
