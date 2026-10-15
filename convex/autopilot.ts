import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { linkedinConfigured } from "./linkedin";
import { asChannel, audit, scheduleDraft } from "./lib/ops";
import { entitlementsFor } from "./lib/plan";

/*
 * Autopilot schedules a finished draft without a person, but only when it is safe:
 * the workspace turned it on, it is a personal LinkedIn post, every claim in it has a
 * source, no review is required, and the author's LinkedIn is connected.
 * Company-page posts always wait for an owner.
 */
export const consider = internalMutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.status !== "ready" || draft.schedule) return;
    const workspace = await ctx.db.get(draft.workspaceId);
    if (!workspace?.autopilot) return;
    if (draft.voice === "company" || asChannel(draft.channel) !== "linkedin") return;
    const claims = draft.claims ?? [];
    if (!draft.claimsCheckedAt || claims.some((claim) => claim.status !== "supported")) return;
    const ent = await entitlementsFor(ctx, draft.workspaceId);
    if (ent.features.review && workspace.reviewRequired) return;
    const author = await ctx.db.get(draft.memberId);
    if (!author?.linkedin || !linkedinConfigured()) return;
    try {
      await scheduleDraft(ctx, { member: author, via: "system" }, draft, {
        mode: "publish",
        reviewFeature: ent.features.review,
        linkedinReady: true,
      });
      await audit(ctx, draft.workspaceId, null, "autopilot.scheduled", draft.title, "Every claim has a source.");
    } catch {
      // A draft autopilot cannot schedule stays ready for its author.
    }
  },
});
