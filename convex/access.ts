import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";
import { role } from "./schema";

export const check = internalQuery({
  args: { workspaceId: v.id("workspaces"), role },
  handler: async (ctx, args) => {
    const member =
      args.role === "owner"
        ? await requireOwner(ctx, args.workspaceId)
        : await requireMember(ctx, args.workspaceId);
    return member._id;
  },
});
