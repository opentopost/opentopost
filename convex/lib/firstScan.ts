import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** How long after the first source is connected the first scan starts, so a few sources can be connected first. */
const WAIT = 10 * 60 * 1000;

/** Called whenever a source is connected. The first scan then starts by itself and comes back with ideas. */
export async function queueFirstScan(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  await ctx.scheduler.runAfter(WAIT, internal.ideas.firstScan, { workspaceId });
}
