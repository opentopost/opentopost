import { httpRouter } from "convex/server";
import { KindeBilling } from "convex-kinde-billing";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { collect } from "./analytics";
import { discovery, mcp, mcpGet, options, rest } from "./agentHttp";

const http = httpRouter();

http.route({ path: "/t", method: "POST", handler: collect });

// The agent surface: REST tools and an MCP server, authenticated with API keys.
http.route({ path: "/api/v1", method: "GET", handler: discovery });
http.route({ pathPrefix: "/api/v1/", method: "POST", handler: rest });
http.route({ pathPrefix: "/api/v1/", method: "OPTIONS", handler: options });
http.route({ path: "/mcp", method: "POST", handler: mcp });
http.route({ path: "/mcp", method: "GET", handler: mcpGet });
http.route({ path: "/mcp", method: "OPTIONS", handler: options });

http.route({
  path: "/slack/oauth",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    if (!code || !state) return Response.redirect(`${site}/sources?slack=cancelled`, 302);
    const destination = await ctx.runAction(internal.slack.completeOAuth, { code, state });
    return Response.redirect(destination, 302);
  }),
});

async function validSignature(request: Request, body: string) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${body}`));
  const expected = `v0=${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

http.route({
  path: "/slack/interactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (!(await validSignature(request, body))) return new Response("Invalid signature", { status: 401 });
    const payload = JSON.parse(new URLSearchParams(body).get("payload") ?? "{}") as {
      type?: string;
      team?: { id: string };
      user?: { id: string };
      response_url?: string;
      trigger_id?: string;
      actions?: { action_id: string; value?: string }[];
      view?: { callback_id?: string; private_metadata?: string; state?: { values?: Record<string, Record<string, { value?: string }>> } };
    };
    if (payload.type === "view_submission" && payload.view?.callback_id === "draft_edit" && payload.team && payload.user) {
      const values = payload.view.state?.values ?? {};
      await ctx.scheduler.runAfter(0, internal.slack.handleEditSubmit, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        draftId: payload.view.private_metadata ?? "",
        hook: values.hook?.value?.value ?? "",
        body: values.body?.value?.value ?? "",
      });
      return new Response(null, { status: 200 });
    }
    if (payload.type === "view_submission" && payload.view?.callback_id === "review_back" && payload.team && payload.user) {
      const comment = payload.view.state?.values?.comment?.value?.value?.trim() ?? "";
      if (!comment) return Response.json({ response_action: "errors", errors: { comment: "Say what should change." } });
      await ctx.scheduler.runAfter(0, internal.slack.handleReviewBack, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        draftId: payload.view.private_metadata ?? "",
        comment: comment.slice(0, 1000),
      });
      return new Response(null, { status: 200 });
    }
    const reviewAction = payload.actions?.find((row) => row.action_id === "review_approve" || row.action_id === "review_back");
    if (payload.type === "block_actions" && reviewAction?.value && payload.team && payload.user) {
      await ctx.scheduler.runAfter(0, internal.slack.handleReviewAction, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        action: reviewAction.action_id.replace("review_", ""),
        draftId: reviewAction.value,
        triggerId: payload.trigger_id,
        responseUrl: payload.response_url,
      });
      return new Response(null, { status: 200 });
    }
    const momentAction = payload.actions?.find((row) => row.action_id === "moment_draft");
    if (payload.type === "block_actions" && momentAction?.value && payload.team && payload.user) {
      await ctx.scheduler.runAfter(0, internal.slack.handleMomentDraft, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        momentId: momentAction.value,
        responseUrl: payload.response_url,
      });
      return new Response(null, { status: 200 });
    }
    const draftAction = payload.actions?.find((row) => row.action_id.startsWith("draft_"));
    if (payload.type === "block_actions" && draftAction?.value && payload.team && payload.user) {
      await ctx.scheduler.runAfter(0, internal.slack.handleDraftAction, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        action: draftAction.action_id.replace("draft_", ""),
        draftId: draftAction.value,
        triggerId: payload.trigger_id,
        responseUrl: payload.response_url,
      });
      return new Response(null, { status: 200 });
    }
    const claim = payload.actions?.find((row) => row.action_id === "claim");
    if (payload.type === "block_actions" && claim?.value && payload.team && payload.user && payload.response_url) {
      await ctx.scheduler.runAfter(0, internal.slack.handleClaim, {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        ideaId: claim.value,
        responseUrl: payload.response_url,
      });
    }
    return new Response(null, { status: 200 });
  }),
});

// Slack Events API: replies in a draft's direct-message thread ask for a change.
http.route({
  path: "/slack/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const payload = JSON.parse(body || "{}") as {
      type?: string;
      challenge?: string;
      team_id?: string;
      event?: { type?: string; channel_type?: string; channel?: string; user?: string; text?: string; thread_ts?: string; ts?: string; bot_id?: string; subtype?: string };
    };
    if (!(await validSignature(request, body))) return new Response("Invalid signature", { status: 401 });
    if (payload.type === "url_verification") return new Response(payload.challenge ?? "", { status: 200 });
    // Slack retries slow responses; the first delivery is enough.
    if (request.headers.get("x-slack-retry-num")) return new Response(null, { status: 200 });
    const event = payload.event;
    if (
      payload.type === "event_callback" &&
      event?.type === "message" &&
      event.channel_type === "im" &&
      !event.bot_id &&
      !event.subtype &&
      event.user &&
      event.channel &&
      event.text?.trim() &&
      payload.team_id
    ) {
      await ctx.scheduler.runAfter(0, internal.slack.handleThreadReply, {
        teamId: payload.team_id,
        slackUserId: event.user,
        channelId: event.channel,
        // A reply in a draft's thread changes that draft. A plain message changes the latest draft.
        threadTs: event.thread_ts && event.thread_ts !== event.ts ? event.thread_ts : undefined,
        text: event.text.trim().slice(0, 500),
      });
    }
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/github/setup",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const destination = await ctx.runAction(internal.github.completeInstall, {
      installationId: url.searchParams.get("installation_id") ?? undefined,
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      setupAction: url.searchParams.get("setup_action") ?? undefined,
    });
    return Response.redirect(destination, 302);
  }),
});

http.route({
  path: "/linkedin/oauth",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const destination = await ctx.runAction(internal.linkedin.completeOAuth, {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
    });
    return Response.redirect(destination, 302);
  }),
});

const kindeBilling = new KindeBilling(components.convexKindeBilling, {
  KINDE_ISSUER_URL: process.env.KINDE_ISSUER_URL ?? "",
});

http.route({
  path: "/webhooks/kinde/billing",
  method: "POST",
  handler: kindeBilling.webhookHandler,
});

export default http;
