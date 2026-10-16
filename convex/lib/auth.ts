import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/*
 * Demo workspaces (demo.opentopost.com) are read-only by default: every mutation that goes
 * through requireMember is refused for them. A mutation that is safe on canned data opts in
 * with allowInDemo(ctx) as its first line.
 */
const demoAllowed = new WeakSet<object>();
export function allowInDemo(ctx: Ctx) {
  demoAllowed.add(ctx);
}
const isMutationCtx = (ctx: Ctx): ctx is MutationCtx => "scheduler" in ctx;

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
  if (isMutationCtx(ctx) && !demoAllowed.has(ctx)) {
    const workspace = await ctx.db.get(workspaceId);
    if (workspace?.demo) throw new ConvexError("This is a demo workspace, so that action is switched off.");
  }
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
