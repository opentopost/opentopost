import { normalize } from "./claims";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isManager, isReviewer } from "./auth";

/*
 * One path for every action, whoever takes it: a person in the app, an API key,
 * an agent over MCP, or a button in Slack. Each action checks access, writes the
 * audit log, records the outcome event, and tells webhooks.
 */

export type Via = "app" | "api" | "slack" | "system";
export type Actor = { member: Doc<"members">; via: Via; keyName?: string };

export const CHANNELS = ["linkedin", "x", "changelog", "investor_update", "newsletter"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_NAMES: Record<Channel, string> = {
  linkedin: "LinkedIn post",
  x: "X post",
  changelog: "Changelog entry",
  investor_update: "Investor update",
  newsletter: "Newsletter section",
};
export const asChannel = (value: string | undefined): Channel =>
  (CHANNELS as readonly string[]).includes(value ?? "") ? (value as Channel) : "linkedin";

export const WEBHOOK_EVENTS = ["idea.created", "draft.ready", "draft.approved", "draft.scheduled", "post.published", "conversion.created"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MIN_LEAD = 60 * 1000;
const MAX_AHEAD = 90 * 24 * 60 * 60 * 1000;
const MAX_REVISIONS = 20;

function actorFields(actor: Actor | null) {
  if (!actor) return { actorType: "system" as const, actorName: "opentopost" };
  if (actor.via === "api")
    return { actorType: "api" as const, actorId: actor.member._id, actorName: `${actor.member.name} (API: ${actor.keyName ?? "key"})` };
  if (actor.via === "slack") return { actorType: "slack" as const, actorId: actor.member._id, actorName: `${actor.member.name} (Slack)` };
  return { actorType: "member" as const, actorId: actor.member._id, actorName: actor.member.name };
}

export async function audit(ctx: MutationCtx, workspaceId: Id<"workspaces">, actor: Actor | null, action: string, target?: string, detail?: string) {
  await ctx.db.insert("auditLog", {
    workspaceId,
    at: Date.now(),
    ...actorFields(actor),
    action,
    target: target?.slice(0, 200),
    detail: detail?.slice(0, 500),
  });
}

/** Queues delivery to every enabled webhook that listens for the event. */
export async function emit(ctx: MutationCtx, workspaceId: Id<"workspaces">, event: WebhookEvent, data: Record<string, unknown>) {
  const hooks = await ctx.db
    .query("webhooks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const hook of hooks.filter((row) => row.enabled && row.events.includes(event))) {
    await ctx.scheduler.runAfter(0, internal.webhooks.deliver, {
      webhookId: hook._id,
      event,
      payload: JSON.stringify({ event, workspaceId, at: new Date().toISOString(), data }),
    });
  }
}

/** One row in the outcome dataset: what happened to a draft, tagged for learning later. */
export async function logDraftEvent(ctx: MutationCtx, draft: Doc<"drafts">, type: string, via: Via, value?: number) {
  const [member, moment, workspace] = await Promise.all([
    ctx.db.get(draft.memberId),
    draft.momentId ? ctx.db.get(draft.momentId) : null,
    ctx.db.get(draft.workspaceId),
  ]);
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: workspace?.timezone ?? "UTC" }));
  const hookIndex = draft.hook ? draft.hooks.indexOf(draft.hook) : -1;
  await ctx.db.insert("draftEvents", {
    workspaceId: draft.workspaceId,
    draftId: draft._id,
    memberId: draft.memberId,
    type,
    at: now.getTime(),
    channel: asChannel(draft.channel),
    voice: draft.voice ?? "personal",
    role: member?.role,
    momentKind: moment?.kind,
    hookIndex: hookIndex >= 0 ? hookIndex : undefined,
    weekday: local.getDay(),
    hour: local.getHours(),
    via,
    value,
  });
}

/* ------------------------------------------------------------------------ */
/* Access                                                                   */

export async function memberOf(ctx: QueryCtx, workspaceId: Id<"workspaces">, kindeUserId: string) {
  return ctx.db
    .query("members")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("kindeUserId", kindeUserId))
    .unique();
}

/** The author edits their draft. Owners and admins also edit company-page drafts. */
export function canEditDraft(member: Doc<"members">, draft: Doc<"drafts">) {
  if (member.workspaceId !== draft.workspaceId) return false;
  if (draft.memberId === member._id) return true;
  return draft.voice === "company" && isManager(member.role);
}

export async function editableDraft(ctx: QueryCtx, member: Doc<"members">, draftId: Id<"drafts">) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.workspaceId !== member.workspaceId) throw new ConvexError("This draft no longer exists.");
  if (!canEditDraft(member, draft)) throw new ConvexError("You can only change your own drafts.");
  return draft;
}

/** Company-page posts always need an approved review when the plan has review. */
export async function reviewNeeded(ctx: QueryCtx, draft: Doc<"drafts">, reviewFeature: boolean) {
  if (!reviewFeature) return false;
  if (draft.voice === "company") return true;
  const workspace = await ctx.db.get(draft.workspaceId);
  return workspace?.reviewRequired ?? false;
}

/* ------------------------------------------------------------------------ */
/* Creating drafts                                                          */

async function insertDraft(
  ctx: MutationCtx,
  actor: Actor,
  fields: Pick<Doc<"drafts">, "workspaceId" | "title"> & Partial<Pick<Doc<"drafts">, "ideaId" | "momentId" | "brief">>,
  channel: Channel,
  company: boolean,
) {
  const draftId = await ctx.db.insert("drafts", {
    ...fields,
    memberId: actor.member._id,
    channel,
    ...(company ? { voice: "company" as const } : {}),
    hooks: [],
    body: "",
    revisions: [],
    status: "generating",
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.drafts.generate, { draftId });
  const draft = (await ctx.db.get(draftId))!;
  await logDraftEvent(ctx, draft, "created", actor.via);
  await audit(ctx, fields.workspaceId, actor, "draft.created", fields.title, `${CHANNEL_NAMES[channel]}${company ? ", company page" : ""}`);
  return draftId;
}

export async function claimIdea(ctx: MutationCtx, actor: Actor, ideaId: Id<"ideas">, opts: { company?: boolean; channel?: Channel } = {}) {
  const idea = await ctx.db.get(ideaId);
  if (!idea || idea.workspaceId !== actor.member.workspaceId) throw new ConvexError("This idea no longer exists.");
  if (opts.company && !isManager(actor.member.role)) throw new ConvexError("Only owners and admins write company-page posts.");
  if (idea.claimedBy && idea.claimedBy !== actor.member._id) throw new ConvexError("Someone else already claimed this idea.");
  if (idea.draftId && (await ctx.db.get(idea.draftId))) return idea.draftId;
  const draftId = await insertDraft(
    ctx,
    actor,
    { workspaceId: idea.workspaceId, ideaId: idea._id, momentId: idea.momentId, title: idea.title },
    opts.channel ?? asChannel(idea.channel),
    Boolean(opts.company),
  );
  await ctx.db.patch(idea._id, { status: "claimed", claimedBy: actor.member._id, draftId });
  return draftId;
}

export async function draftFromMoment(ctx: MutationCtx, actor: Actor, momentId: Id<"moments">, channel: Channel, company: boolean) {
  const moment = await ctx.db.get(momentId);
  if (!moment || moment.workspaceId !== actor.member.workspaceId) throw new ConvexError("This moment no longer exists.");
  if (company && !isManager(actor.member.role)) throw new ConvexError("Only owners and admins write company-page posts.");
  return insertDraft(ctx, actor, { workspaceId: moment.workspaceId, momentId: moment._id, title: moment.title }, channel, company);
}

function titleFrom(text: string) {
  const line = text.trim().split("\n")[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}

export async function draftFromBrief(ctx: MutationCtx, actor: Actor, briefText: string, channel: Channel, company: boolean) {
  const brief = briefText.trim();
  if (brief.length < 15) throw new ConvexError("Describe the idea in a sentence or two.");
  if (brief.length > 6000) throw new ConvexError("Keep the idea under 6,000 characters.");
  if (company && !isManager(actor.member.role)) throw new ConvexError("Only owners and admins write company-page posts.");
  return insertDraft(ctx, actor, { workspaceId: actor.member.workspaceId, brief, title: titleFrom(brief) }, channel, company);
}

/* ------------------------------------------------------------------------ */
/* Changing drafts                                                          */

const resetReview = { reviewState: "none" as const, review: undefined };

export async function reviseDraft(
  ctx: MutationCtx,
  actor: Actor,
  draft: Doc<"drafts">,
  instruction: string,
  current?: { hook: string; body: string },
) {
  const change = instruction.trim();
  if (!change) throw new ConvexError("Say what to change.");
  if (draft.status === "generating") throw new ConvexError("This draft is still being written. Try again in a moment.");
  await ctx.db.patch(draft._id, {
    ...(current ? { hook: current.hook, body: current.body } : {}),
    status: "generating",
    error: undefined,
    pendingInstruction: change.slice(0, 500),
    updatedAt: Date.now(),
    ...resetReview,
  });
  await ctx.scheduler.runAfter(0, internal.drafts.generate, { draftId: draft._id });
  await logDraftEvent(ctx, draft, "revision_requested", actor.via);
  await audit(ctx, draft.workspaceId, actor, "draft.revision_requested", draft.title, change);
}

export async function editDraft(ctx: MutationCtx, actor: Actor, draft: Doc<"drafts">, hook: string, body: string) {
  if (draft.hook === hook && draft.body === body) return false;
  const revisions = draft.body !== body ? [...draft.revisions, { at: Date.now(), body: draft.body }].slice(-MAX_REVISIONS) : draft.revisions;
  const reviewed = draft.reviewState === "approved" || draft.reviewState === "pending";
  await ctx.db.patch(draft._id, {
    hook: hook.trim(),
    body,
    revisions,
    updatedAt: Date.now(),
    ...(reviewed ? resetReview : {}),
  });
  await logDraftEvent(ctx, { ...draft, hook: hook.trim() }, "edited", actor.via, body.length - draft.body.length);
  return draft.body !== body;
}

export async function askForReview(ctx: MutationCtx, actor: Actor, draft: Doc<"drafts">, reviewFeature: boolean) {
  if (draft.status !== "ready") throw new ConvexError("Finish the draft before you ask for review.");
  if (!reviewFeature) throw new ConvexError("Review before posting is part of the Team plan.");
  await ctx.db.patch(draft._id, { reviewState: "pending", review: { requestedAt: Date.now() }, checkingClaims: true });
  await ctx.scheduler.runAfter(0, internal.drafts.verify, { draftId: draft._id });
  await audit(ctx, draft.workspaceId, actor, "review.requested", draft.title);
  await ctx.scheduler.runAfter(0, internal.slack.notifyReview, { draftId: draft._id, kind: "requested" });
}

/**
 * Claims from the last check that still appear in the draft and have no source or break a rule.
 * A claim the author has since removed from the text no longer counts.
 */
export function openClaims(draft: Doc<"drafts">) {
  const text = normalize(`${draft.hook ?? ""}\n${draft.body}`);
  return (draft.claims ?? []).filter((row) => row.status !== "supported" && text.includes(normalize(row.text).slice(0, 60)));
}

export function requireSourcedClaims(draft: Doc<"drafts">) {
  const open = openClaims(draft).length;
  if (open === 0) return;
  throw new ConvexError(
    `This draft has ${open} ${open === 1 ? "claim" : "claims"} without a source. Remove or reword ${open === 1 ? "it" : "them"} first, or ask for a change such as "remove the claim without a source".`,
  );
}

export async function decideReview(ctx: MutationCtx, actor: Actor, draft: Doc<"drafts">, approve: boolean, commentText?: string) {
  if (!isReviewer(actor.member.role)) throw new ConvexError("Only owners, admins, and reviewers can review drafts.");
  if (draft.reviewState !== "pending") throw new ConvexError("This draft is not waiting for review.");
  if (actor.member._id === draft.memberId) {
    const reviewers = (
      await ctx.db
        .query("members")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", draft.workspaceId))
        .collect()
    ).filter((member) => isReviewer(member.role));
    if (reviewers.length > 1) throw new ConvexError("Another reviewer needs to review your draft.");
  }
  const comment = commentText?.trim();
  if (!approve && !comment) throw new ConvexError("Say what to change.");
  if (approve) requireSourcedClaims(draft);
  await ctx.db.patch(draft._id, {
    reviewState: approve ? "approved" : "changes_requested",
    review: {
      requestedAt: draft.review?.requestedAt ?? Date.now(),
      reviewerId: actor.member._id,
      decidedAt: Date.now(),
      comment: comment?.slice(0, 1000),
    },
  });
  await logDraftEvent(ctx, draft, approve ? "approved" : "changes_requested", actor.via);
  await audit(ctx, draft.workspaceId, actor, approve ? "review.approved" : "review.changes_requested", draft.title, comment);
  if (approve) await emit(ctx, draft.workspaceId, "draft.approved", { draftId: draft._id, title: draft.title });
  await ctx.scheduler.runAfter(0, internal.slack.notifyReview, { draftId: draft._id, kind: approve ? "approved" : "changes" });
}

/** The next posting slot: the workspace's posting hour on the next weekday, at least an hour away. */
export function nextSlot(timezone: string, hour = 9, from = Date.now()) {
  for (let days = 0; days < 8; days++) {
    const probe = new Date(from + days * 86_400_000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(probe);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(probe);
    if (weekday === "Sat" || weekday === "Sun") continue;
    // Find the UTC time for `hour`:00 on that local date.
    const guess = Date.parse(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
    const offsetName =
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
        .formatToParts(new Date(guess))
        .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(offsetName);
    const offset = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
    const at = guess - offset * 60_000;
    if (at > from + 60 * 60 * 1000) return at;
  }
  return from + 24 * 60 * 60 * 1000;
}

export async function scheduleDraft(
  ctx: MutationCtx,
  actor: Actor,
  draft: Doc<"drafts">,
  opts: { at?: number; mode?: "publish" | "remind"; reviewFeature: boolean; linkedinReady: boolean },
) {
  if (draft.status !== "ready") throw new ConvexError("Finish the draft before you schedule it.");
  requireSourcedClaims(draft);
  const workspace = await ctx.db.get(draft.workspaceId);
  // Personal posts use the author's own time zone and hour when set. Company posts use the workspace's.
  const owner = draft.voice === "company" ? null : await ctx.db.get(draft.memberId);
  const zone = owner?.timezone ?? workspace?.timezone ?? "UTC";
  const at = opts.at ?? nextSlot(zone, owner?.postHour ?? workspace?.postHour ?? 9);
  if (at < Date.now() + MIN_LEAD) throw new ConvexError("Choose a time at least one minute from now.");
  if (at > Date.now() + MAX_AHEAD) throw new ConvexError("Choose a time in the next 90 days.");
  if ((await reviewNeeded(ctx, draft, opts.reviewFeature)) && draft.reviewState !== "approved") {
    throw new ConvexError("This draft needs an approved review before you schedule it.");
  }
  const author = await ctx.db.get(draft.memberId);
  const channel = asChannel(draft.channel);
  // Publish by default when the author's LinkedIn is connected; otherwise remind.
  const canPublish =
    channel === "linkedin" && draft.voice !== "company" && opts.linkedinReady && Boolean(author?.linkedin && author.linkedin.expiresAt > at);
  const mode = opts.mode ?? (canPublish ? "publish" : "remind");
  if (mode === "publish") {
    if (channel !== "linkedin") throw new ConvexError("Only LinkedIn posts publish automatically. Schedule a reminder instead.");
    if (draft.voice === "company") throw new ConvexError("LinkedIn only lets approved apps post to company pages. Schedule a reminder instead.");
    if (actor.member._id !== draft.memberId) throw new ConvexError("Only the author can schedule a post to their own LinkedIn.");
    if (!opts.linkedinReady) throw new ConvexError("LinkedIn publishing is not set up on this deployment. Schedule a reminder instead.");
    if (!canPublish) throw new ConvexError("Connect LinkedIn on the Calendar page first. The connection must still be valid at the scheduled time.");
  }
  if (draft.schedule?.jobId && draft.schedule.state === "scheduled") await ctx.scheduler.cancel(draft.schedule.jobId);
  const jobId = await ctx.scheduler.runAt(at, internal.schedule.fire, { draftId: draft._id, at });
  await ctx.db.patch(draft._id, { schedule: { at, mode, state: "scheduled", jobId }, scheduledAt: at });
  await logDraftEvent(ctx, draft, "scheduled", actor.via, at);
  await audit(ctx, draft.workspaceId, actor, "draft.scheduled", draft.title, `${mode} at ${new Date(at).toISOString()}`);
  await emit(ctx, draft.workspaceId, "draft.scheduled", { draftId: draft._id, title: draft.title, at: new Date(at).toISOString(), mode });
  return { at, mode };
}

export async function cancelSchedule(ctx: MutationCtx, actor: Actor, draft: Doc<"drafts">) {
  if (!draft.schedule) return;
  if (draft.schedule.state === "publishing") throw new ConvexError("This post is being published right now.");
  if (draft.schedule.jobId && draft.schedule.state === "scheduled") await ctx.scheduler.cancel(draft.schedule.jobId);
  await ctx.db.patch(draft._id, { schedule: undefined, scheduledAt: undefined });
  await audit(ctx, draft.workspaceId, actor, "draft.unscheduled", draft.title);
}

/** "Pass" on a draft: delete it and free the idea for someone else. */
export async function passDraft(ctx: MutationCtx, actor: Actor, draft: Doc<"drafts">) {
  if (draft.schedule?.jobId && draft.schedule.state === "scheduled") await ctx.scheduler.cancel(draft.schedule.jobId);
  if (draft.ideaId) {
    const idea = await ctx.db.get(draft.ideaId);
    if (idea && idea.status !== "posted") await ctx.db.patch(idea._id, { status: "new", draftId: undefined, claimedBy: undefined });
  }
  await logDraftEvent(ctx, draft, "passed", actor.via);
  await audit(ctx, draft.workspaceId, actor, "draft.deleted", draft.title);
  for (const file of draft.media ?? []) await ctx.storage.delete(file.storageId);
  await ctx.db.delete(draft._id);
}
