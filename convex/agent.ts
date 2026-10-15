import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { postUrl, recordPosted } from "./drafts";
import { requestScan } from "./ideas";
import { linkedinConfigured } from "./linkedin";
import { isManager } from "./lib/auth";
import {
  type Actor,
  asChannel,
  askForReview,
  audit,
  cancelSchedule,
  canEditDraft,
  claimIdea,
  decideReview,
  draftFromBrief,
  draftFromMoment,
  editDraft,
  reviseDraft,
  scheduleDraft,
} from "./lib/ops";
import { entitlementsFor } from "./lib/plan";
import { toolByName } from "./lib/tools";
import { addTextSample, scheduleAuto } from "./voice";

/*
 * Runs one agent tool as the member an API key belongs to.
 * The HTTP layer (http.ts) checks the key and its scopes before it calls this.
 */

type Input = Record<string, unknown>;

const str = (input: Input, key: string, required = true) => {
  const value = input[key];
  if (typeof value === "string" && value.trim()) return value;
  if (required) throw new ConvexError(`"${key}" is required.`);
  return undefined;
};
const bool = (input: Input, key: string) => (typeof input[key] === "boolean" ? (input[key] as boolean) : undefined);
const limit = (input: Input) => Math.min(50, Math.max(1, Math.floor(typeof input.limit === "number" ? input.limit : 20)));

async function draftFor(ctx: MutationCtx, actor: Actor, input: Input, edit: boolean) {
  const draftId = str(input, "draftId")!;
  const draft = await ctx.db.get(draftId as Id<"drafts">).catch(() => null);
  if (!draft || draft.workspaceId !== actor.member.workspaceId) throw new ConvexError("No draft with that id in this workspace.");
  if (edit && !canEditDraft(actor.member, draft)) throw new ConvexError("This key can only change its own member's drafts.");
  return draft;
}

function draftView(draft: Doc<"drafts">) {
  return {
    id: draft._id,
    title: draft.title,
    channel: asChannel(draft.channel),
    voice: draft.voice ?? "personal",
    status: draft.status,
    hooks: draft.hooks,
    hook: draft.hook ?? draft.hooks[0] ?? null,
    body: draft.body,
    claims: (draft.claims ?? []).map((claim) => ({ text: claim.text, status: claim.status, factIds: claim.factIds, note: claim.note ?? null })),
    reviewState: draft.reviewState ?? "none",
    schedule: draft.schedule ? { at: new Date(draft.schedule.at).toISOString(), mode: draft.schedule.mode, state: draft.schedule.state } : null,
    error: draft.error ?? null,
    updatedAt: new Date(draft.updatedAt).toISOString(),
  };
}

export const run = internalMutation({
  args: { memberId: v.id("members"), keyName: v.string(), scopes: v.array(v.string()), tool: v.string(), input: v.any() },
  handler: async (ctx, args): Promise<unknown> => {
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new ConvexError("The member for this key no longer exists.");
    const tool = toolByName.get(args.tool);
    if (!tool) throw new ConvexError(`Unknown tool "${args.tool}".`);
    if (!args.scopes.includes(tool.scope)) throw new ConvexError(`This key does not have the "${tool.scope}" permission.`);
    const actor: Actor = { member, via: "api", keyName: args.keyName };
    const input = (args.input && typeof args.input === "object" ? args.input : {}) as Input;
    const workspaceId = member.workspaceId;

    switch (tool.name) {
      case "whoami": {
        const workspace = await ctx.db.get(workspaceId);
        const ent = await entitlementsFor(ctx, workspaceId);
        return { workspace: { id: workspaceId, name: workspace?.name }, member: { id: member._id, name: member.name, role: member.role }, scopes: args.scopes, plan: ent.plan };
      }
      case "list_ideas": {
        const ideas = await ctx.db
          .query("ideas")
          .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId))
          .order("desc")
          .take(200);
        const status = str(input, "status", false);
        const rows = ideas.filter((idea) => idea.status !== "dismissed" && (!status || idea.status === status)).sort((a, b) => b.score - a.score).slice(0, limit(input));
        return Promise.all(
          rows.map(async (idea) => {
            const moment = idea.momentId ? await ctx.db.get(idea.momentId) : null;
            const suggested = idea.suggestedMemberId ? await ctx.db.get(idea.suggestedMemberId) : null;
            return {
              id: idea._id,
              title: idea.title,
              angle: idea.angle,
              score: idea.score,
              status: idea.status,
              weekOf: idea.weekOf,
              suggestedFor: suggested?.name ?? null,
              draftId: idea.draftId ?? null,
              facts: moment ? moment.facts.map((fact) => ({ id: fact.id, text: fact.text, quote: fact.quote ?? null })) : [],
            };
          }),
        );
      }
      case "list_moments": {
        const moments = await ctx.db
          .query("moments")
          .withIndex("by_workspace_occurred", (q) => q.eq("workspaceId", workspaceId))
          .order("desc")
          .take(100);
        return moments
          .filter((moment) => moment.status === "active")
          .slice(0, limit(input))
          .map((moment) => ({
            id: moment._id,
            title: moment.title,
            summary: moment.summary,
            kind: moment.kind,
            people: moment.people,
            occurredAt: new Date(moment.occurredAt).toISOString(),
            facts: moment.facts.map((fact) => ({ id: fact.id, text: fact.text, quote: fact.quote ?? null })),
          }));
      }
      case "list_drafts": {
        const drafts = await ctx.db
          .query("drafts")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .order("desc")
          .take(limit(input));
        return drafts.map(draftView);
      }
      case "get_draft": {
        const draft = await draftFor(ctx, actor, input, false);
        if (draft.memberId !== member._id && draft.voice !== "company" && !isManager(member.role) && member.role !== "reviewer") {
          throw new ConvexError("This key can only read its own member's drafts.");
        }
        return draftView(draft);
      }
      case "get_recap": {
        const recap = await ctx.db
          .query("recaps")
          .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId))
          .order("desc")
          .first();
        return recap ? { weekOf: recap.weekOf, summary: recap.summary, stats: recap.stats } : null;
      }
      case "claim_idea": {
        const draftId = await claimIdea(ctx, actor, str(input, "ideaId") as Id<"ideas">, {
          company: bool(input, "company"),
          channel: input.channel ? asChannel(String(input.channel)) : undefined,
        });
        return { draftId, status: "generating" };
      }
      case "draft_from_moment": {
        const draftId = await draftFromMoment(ctx, actor, str(input, "momentId") as Id<"moments">, asChannel(String(input.channel ?? "linkedin")), Boolean(bool(input, "company")));
        return { draftId, status: "generating" };
      }
      case "draft_from_brief": {
        const draftId = await draftFromBrief(ctx, actor, str(input, "brief")!, asChannel(String(input.channel ?? "linkedin")), Boolean(bool(input, "company")));
        return { draftId, status: "generating" };
      }
      case "revise_draft": {
        const draft = await draftFor(ctx, actor, input, true);
        await reviseDraft(ctx, actor, draft, str(input, "instruction")!);
        return { draftId: draft._id, status: "generating" };
      }
      case "edit_draft": {
        const draft = await draftFor(ctx, actor, input, true);
        const changed = await editDraft(ctx, actor, draft, str(input, "hook", false) ?? draft.hook ?? draft.hooks[0] ?? "", str(input, "body", false) ?? draft.body);
        if (changed && draft.voice !== "company") await scheduleAuto(ctx, { memberId: draft.memberId }, 10 * 60 * 1000);
        return draftView((await ctx.db.get(draft._id))!);
      }
      case "add_voice_sample": {
        const kind = (str(input, "kind", false) ?? "post") as Doc<"voiceSamples">["kind"];
        await addTextSample(ctx, member, { memberId: member._id }, { workspaceId, kind, text: str(input, "text")! });
        await audit(ctx, workspaceId, actor, "voice.sample_added", kind);
        return { ok: true };
      }
      case "request_review": {
        const draft = await draftFor(ctx, actor, input, true);
        const ent = await entitlementsFor(ctx, workspaceId);
        await askForReview(ctx, actor, draft, ent.features.review);
        return { draftId: draft._id, reviewState: "pending" };
      }
      case "review_draft": {
        const draft = await draftFor(ctx, actor, input, false);
        await decideReview(ctx, actor, draft, Boolean(bool(input, "approve")), str(input, "comment", false));
        return draftView((await ctx.db.get(draft._id))!);
      }
      case "schedule_draft": {
        const draft = await draftFor(ctx, actor, input, true);
        const ent = await entitlementsFor(ctx, workspaceId);
        const atText = str(input, "at", false);
        const at = atText ? Date.parse(atText) : undefined;
        if (atText && Number.isNaN(at)) throw new ConvexError('"at" must be an ISO 8601 date and time.');
        const mode = input.mode === "publish" || input.mode === "remind" ? input.mode : undefined;
        const result = await scheduleDraft(ctx, actor, draft, { at, mode, reviewFeature: ent.features.review, linkedinReady: linkedinConfigured() });
        return { draftId: draft._id, at: new Date(result.at).toISOString(), mode: result.mode };
      }
      case "cancel_schedule": {
        const draft = await draftFor(ctx, actor, input, true);
        await cancelSchedule(ctx, actor, draft);
        return { draftId: draft._id, schedule: null };
      }
      case "mark_posted": {
        const draft = await draftFor(ctx, actor, input, true);
        const url = postUrl(draft, str(input, "url") ?? "");
        const ent = await entitlementsFor(ctx, workspaceId);
        if (ent.features.review && (draft.voice === "company" || (await ctx.db.get(workspaceId))?.reviewRequired) && draft.reviewState !== "approved") {
          throw new ConvexError("This draft needs an approved review before it is posted.");
        }
        await recordPosted(ctx, draft, url);
        return { draftId: draft._id, status: "posted" };
      }
      case "start_scan": {
        if (!isManager(member.role)) throw new ConvexError("Only owners and admins can start a scan.");
        await requestScan(ctx, { workspaceId });
        await audit(ctx, workspaceId, actor, "scan.started");
        return { status: "running" };
      }
    }
    throw new ConvexError(`Unknown tool "${args.tool}".`);
  },
});
