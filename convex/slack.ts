import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { isReviewer, requireMember, requireOwner } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { entitlementsFor, teamOnly } from "./lib/plan";
import { countedSources, sourceLimitMessage } from "./sources";
import {
  type Actor,
  askForReview,
  canEditDraft,
  claimIdea,
  decideReview,
  draftFromMoment,
  editDraft,
  openClaims,
  passDraft,
  requireSourcedClaims,
  reviewNeeded,
  reviseDraft,
  scheduleDraft,
} from "./lib/ops";
import { linkedinConfigured } from "./linkedin";

const SCOPES = [
  "channels:history",
  "channels:read",
  "channels:join",
  "chat:write",
  "team:read",
  "users:read",
  "users:read.email",
  "im:write",
  "im:history",
];
const LOOKBACK = 14 * 24 * 60 * 60 * 1000;
const MIN_LENGTH = 40;

type Channel = { id: string; name: string };
type SlackConfig = {
  teamId: string;
  teamName: string;
  teamDomain?: string;
  botUserId?: string;
  channels: Channel[];
  ideasChannel?: Channel;
};

const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const configured = () => Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_SIGNING_SECRET);

async function slackApi<T>(method: string, token: string, params: Record<string, string | number | boolean> = {}, json?: unknown): Promise<T> {
  const response = json
    ? await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(json),
      })
    : await fetch(`https://slack.com/api/${method}?${new URLSearchParams(Object.entries(params).map(([k, val]) => [k, String(val)]))}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  const body = (await response.json()) as T & { ok: boolean; error?: string };
  if (!body.ok) throw new Error(`Slack ${method} failed: ${body.error ?? response.status}`);
  return body;
}

async function slackSource(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return sources.find((source) => source.type === "slack") ?? null;
}

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const source = await slackSource(ctx, args.workspaceId);
    const config = source?.config as SlackConfig | undefined;
    return {
      available: configured(),
      connected: Boolean(source),
      teamName: config?.teamName ?? null,
      channels: config?.channels ?? [],
      ideasChannel: config?.ideasChannel ?? null,
      lastScannedAt: source?.lastScannedAt ?? null,
    };
  },
});

export const startOAuth = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<string> => {
    if (!configured()) throw new ConvexError("Slack is not set up on this deployment.");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await ctx.runMutation(internal.slack.saveState, { workspaceId: args.workspaceId, state });
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("redirect_uri", `${process.env.CONVEX_SITE_URL}/slack/oauth`);
    url.searchParams.set("state", state);
    return url.toString();
  },
});

export const saveState = internalMutation({
  args: { workspaceId: v.id("workspaces"), state: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const ent = await entitlementsFor(ctx, args.workspaceId);
    if (!ent.features.slack) throw new ConvexError(teamOnly("slack"));
    const existing = await slackSource(ctx, args.workspaceId);
    if (!existing) {
      const count = await countedSources(ctx, args.workspaceId);
      const { limits } = await entitlementsFor(ctx, args.workspaceId);
      if (count >= limits.sources) {
        throw new ConvexError(sourceLimitMessage("team", limits.sources));
      }
    }
    await ctx.db.insert("slackStates", {
      state: args.state,
      workspaceId: args.workspaceId,
      memberId: owner._id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  },
});

export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("slackStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row || (row.provider && row.provider !== "slack")) return null;
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) return null;
    return { workspaceId: row.workspaceId, memberId: row.memberId };
  },
});

export const expireStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("slackStates").take(500);
    for (const row of rows) if (row.expiresAt < Date.now()) await ctx.db.delete(row._id);
  },
});

export const completeOAuth = internalAction({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const target = await ctx.runMutation(internal.slack.consumeState, { state: args.state });
    if (!target) return `${siteUrl()}/sources?slack=expired`;
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code: args.code,
        redirect_uri: `${process.env.CONVEX_SITE_URL}/slack/oauth`,
      }),
    });
    const body = (await response.json()) as {
      ok: boolean;
      access_token?: string;
      bot_user_id?: string;
      team?: { id: string; name: string };
      authed_user?: { id?: string };
    };
    if (!body.ok || !body.access_token || !body.team) return `${siteUrl()}/sources?slack=error`;
    let teamDomain: string | undefined;
    try {
      const info = await slackApi<{ team: { domain: string } }>("team.info", body.access_token);
      teamDomain = info.team.domain;
    } catch {
      teamDomain = undefined;
    }
    const sealed = await encrypt(body.access_token);
    await ctx.runMutation(internal.slack.saveConnection, {
      workspaceId: target.workspaceId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      last4: body.access_token.slice(-4),
      config: { teamId: body.team.id, teamName: body.team.name, teamDomain, botUserId: body.bot_user_id, channels: [] },
      installer: body.authed_user?.id ? { memberId: target.memberId, slackUserId: body.authed_user.id } : undefined,
    });
    return `${siteUrl()}/sources?slack=connected`;
  },
});

export const saveConnection = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
    config: v.object({
      teamId: v.string(),
      teamName: v.string(),
      teamDomain: v.optional(v.string()),
      botUserId: v.optional(v.string()),
      channels: v.array(v.object({ id: v.string(), name: v.string() })),
    }),
    installer: v.optional(v.object({ memberId: v.id("members"), slackUserId: v.string() })),
  },
  handler: async (ctx, args) => {
    // Link the person who installed the app to their Slack user, even when their Slack email differs.
    if (args.installer) {
      const installer = await ctx.db.get(args.installer.memberId);
      if (installer && installer.workspaceId === args.workspaceId) await ctx.db.patch(installer._id, { slackUserId: args.installer.slackUserId });
    }
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) => q.eq("workspaceId", args.workspaceId).eq("kind", "slack").eq("label", "slack"))
      .unique();
    const fields = { ciphertext: args.ciphertext, iv: args.iv, last4: args.last4, testedAt: Date.now(), testOk: true };
    if (secret) await ctx.db.patch(secret._id, fields);
    else await ctx.db.insert("secrets", { workspaceId: args.workspaceId, kind: "slack", label: "slack", ...fields });
    const source = await slackSource(ctx, args.workspaceId);
    if (source) {
      const previous = source.config as SlackConfig;
      await ctx.db.patch(source._id, {
        config: { ...args.config, channels: previous.channels ?? [], ideasChannel: previous.ideasChannel },
        enabled: true,
      });
    } else {
      await ctx.db.insert("sources", { workspaceId: args.workspaceId, type: "slack", config: args.config, enabled: true });
    }
  },
});

export const connection = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const source = await slackSource(ctx, args.workspaceId);
    if (!source || !source.enabled) return null;
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) => q.eq("workspaceId", args.workspaceId).eq("kind", "slack").eq("label", "slack"))
      .unique();
    if (!secret) return null;
    return {
      sourceId: source._id,
      config: source.config as SlackConfig,
      lastScannedAt: source.lastScannedAt ?? null,
      ciphertext: secret.ciphertext,
      iv: secret.iv,
    };
  },
});

export const connectionForTeam = internalQuery({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("sources")
      .filter((q) => q.eq(q.field("type"), "slack"))
      .collect();
    const source = sources.find((row) => (row.config as SlackConfig).teamId === args.teamId);
    return source ? { workspaceId: source.workspaceId } : null;
  },
});

async function token(
  ctx: { runQuery: (ref: typeof internal.slack.connection, args: { workspaceId: Id<"workspaces"> }) => Promise<unknown> },
  workspaceId: Id<"workspaces">,
) {
  const conn = (await ctx.runQuery(internal.slack.connection, { workspaceId })) as {
    sourceId: Id<"sources">;
    config: SlackConfig;
    lastScannedAt: number | null;
    ciphertext: string;
    iv: string;
  } | null;
  if (!conn) return null;
  return { ...conn, token: await decrypt(conn.ciphertext, conn.iv) };
}

export const listChannels = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<Channel[]> => {
    await ctx.runQuery(internal.access.check, { workspaceId: args.workspaceId, role: "owner" });
    const conn = await token(ctx, args.workspaceId);
    if (!conn) throw new ConvexError("Connect Slack first.");
    const channels: Channel[] = [];
    let cursor = "";
    do {
      const page = await slackApi<{ channels: { id: string; name: string }[]; response_metadata?: { next_cursor?: string } }>(
        "conversations.list",
        conn.token,
        { types: "public_channel", exclude_archived: true, limit: 500, ...(cursor ? { cursor } : {}) },
      );
      channels.push(...page.channels.map((c) => ({ id: c.id, name: c.name })));
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor && channels.length < 2000);
    return channels.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveChannels = action({
  args: {
    workspaceId: v.id("workspaces"),
    channels: v.array(v.object({ id: v.string(), name: v.string() })),
    ideasChannel: v.optional(v.object({ id: v.string(), name: v.string() })),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runQuery(internal.access.check, { workspaceId: args.workspaceId, role: "owner" });
    if (args.channels.length > 20) throw new ConvexError("Choose up to 20 channels.");
    const conn = await token(ctx, args.workspaceId);
    if (!conn) throw new ConvexError("Connect Slack first.");
    const join = [...args.channels, ...(args.ideasChannel ? [args.ideasChannel] : [])];
    for (const channel of join) {
      await slackApi("conversations.join", conn.token, {}, { channel: channel.id });
    }
    await ctx.runMutation(internal.slack.setChannels, {
      sourceId: conn.sourceId,
      channels: args.channels,
      ideasChannel: args.ideasChannel,
    });
  },
});

export const setChannels = internalMutation({
  args: {
    sourceId: v.id("sources"),
    channels: v.array(v.object({ id: v.string(), name: v.string() })),
    ideasChannel: v.optional(v.object({ id: v.string(), name: v.string() })),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;
    await ctx.db.patch(source._id, {
      config: { ...(source.config as SlackConfig), channels: args.channels, ideasChannel: args.ideasChannel },
    });
  },
});

export const disconnect = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const source = await slackSource(ctx, args.workspaceId);
    if (source) await ctx.db.delete(source._id);
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) => q.eq("workspaceId", args.workspaceId).eq("kind", "slack").eq("label", "slack"))
      .unique();
    if (secret) await ctx.db.delete(secret._id);
  },
});

type SlackMessage = {
  ts: string;
  text?: string;
  user?: string;
  subtype?: string;
  bot_id?: string;
  reply_count?: number;
};

function cleanText(text: string, names: Map<string, string>) {
  return text
    .replace(/<@([A-Z0-9]+)>/g, (_, id: string) => `@${names.get(id) ?? "someone"}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export const ingest = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    const conn = await token(ctx, args.workspaceId);
    if (!conn || conn.config.channels.length === 0) return;
    const oldest = Math.max(conn.lastScannedAt ?? 0, Date.now() - LOOKBACK) / 1000;
    const names = new Map<string, string>();
    const nameOf = async (id?: string) => {
      if (!id) return "someone";
      if (!names.has(id)) {
        try {
          const info = await slackApi<{ user: { real_name?: string; name: string } }>("users.info", conn.token, { user: id });
          names.set(id, info.user.real_name || info.user.name);
        } catch {
          names.set(id, "someone");
        }
      }
      return names.get(id)!;
    };
    const items: { externalId: string; title: string; text: string; author: string; url?: string; createdAt: number }[] = [];
    for (const channel of conn.config.channels) {
      let history: { messages: SlackMessage[] };
      try {
        history = await slackApi("conversations.history", conn.token, { channel: channel.id, oldest, limit: 200 });
      } catch {
        continue;
      }
      for (const message of history.messages) {
        if (message.bot_id || (message.subtype && message.subtype !== "thread_broadcast") || !message.text) continue;
        const author = await nameOf(message.user);
        let text = message.text;
        if (message.reply_count) {
          try {
            const thread = await slackApi<{ messages: SlackMessage[] }>("conversations.replies", conn.token, {
              channel: channel.id,
              ts: message.ts,
              limit: 50,
            });
            const replies = [];
            for (const reply of thread.messages.slice(1)) {
              if (reply.bot_id || !reply.text) continue;
              replies.push(`- ${await nameOf(reply.user)}: ${reply.text}`);
            }
            if (replies.length) text = `${text}\n\nReplies:\n${replies.join("\n")}`;
          } catch {
            text = message.text;
          }
        }
        for (const id of text.match(/<@([A-Z0-9]+)>/g) ?? []) await nameOf(id.slice(2, -1));
        const cleaned = cleanText(text, names);
        if (cleaned.length < MIN_LENGTH) continue;
        items.push({
          externalId: `${channel.id}:${message.ts}`,
          title: `#${channel.name}`,
          text: cleaned.slice(0, 8000),
          author,
          url: conn.config.teamDomain
            ? `https://${conn.config.teamDomain}.slack.com/archives/${channel.id}/p${message.ts.replace(".", "")}`
            : undefined,
          createdAt: Math.round(Number(message.ts) * 1000),
        });
      }
    }
    if (items.length) {
      await ctx.runMutation(internal.slack.saveItems, { workspaceId: args.workspaceId, sourceId: conn.sourceId, items });
    }
  },
});

export const saveItems = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    items: v.array(
      v.object({
        externalId: v.string(),
        title: v.string(),
        text: v.string(),
        author: v.string(),
        url: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      const existing = await ctx.db
        .query("sourceItems")
        .withIndex("by_source_external", (q) => q.eq("sourceId", args.sourceId).eq("externalId", item.externalId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, { text: item.text });
      else await ctx.db.insert("sourceItems", { workspaceId: args.workspaceId, sourceId: args.sourceId, ...item });
    }
  },
});

export const ideasForRun = internalQuery({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return [];
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", run.workspaceId).eq("status", "new"))
      .collect();
    const rows = [];
    for (const idea of ideas
      .filter((row) => row.runId === args.runId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)) {
      const member = idea.suggestedMemberId ? await ctx.db.get(idea.suggestedMemberId) : null;
      rows.push({ _id: idea._id, title: idea.title, angle: idea.angle, score: idea.score, suggested: member?.name ?? null });
    }
    return rows;
  },
});

export const postIdeas = internalAction({
  args: { workspaceId: v.id("workspaces"), runId: v.id("runs") },
  handler: async (ctx, args): Promise<void> => {
    const conn = await token(ctx, args.workspaceId);
    if (!conn?.config.ideasChannel) return;
    const ideas = await ctx.runQuery(internal.slack.ideasForRun, { runId: args.runId });
    if (ideas.length === 0) return;
    const blocks: unknown[] = [{ type: "header", text: { type: "plain_text", text: "This week's post ideas" } }];
    for (const idea of ideas) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${idea.title}*  \`${idea.score}\`\n${idea.angle}${idea.suggested ? `\n_For ${idea.suggested}_` : ""}`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", style: "primary", text: { type: "plain_text", text: "Claim and draft" }, action_id: "claim", value: idea._id },
            { type: "button", text: { type: "plain_text", text: "Open ideas" }, action_id: "open", url: `${siteUrl()}/ideas` },
          ],
        },
      );
    }
    await slackApi(
      "chat.postMessage",
      conn.token,
      {},
      {
        channel: conn.config.ideasChannel.id,
        text: "This week's post ideas",
        blocks,
        unfurl_links: false,
      },
    );
  },
});

export const postRecap = internalAction({
  args: { recapId: v.id("recaps") },
  handler: async (ctx, args): Promise<void> => {
    const recap = await ctx.runQuery(internal.recaps.forSlack, args);
    if (!recap || recap.sent || recap.stats.posts === 0) return;
    const conn = await token(ctx, recap.workspaceId);
    if (!conn?.config.ideasChannel) return;
    const top = recap.stats.top
      .map((post, index) => `${index + 1}. <${post.url}|${post.title}> by ${post.author}: ${post.clicks} clicks, ${post.conversions} conversions`)
      .join("\n");
    const people = recap.stats.people
      .filter((person) => person.posts > 0)
      .map((person) => `${person.name}: ${person.posts}${person.streak > 1 ? ` (${person.streak}-week streak)` : ""}`)
      .join("\n");
    await slackApi(
      "chat.postMessage",
      conn.token,
      {},
      {
        channel: conn.config.ideasChannel.id,
        text: `Weekly recap: ${recap.summary}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "Weekly recap" } },
          { type: "section", text: { type: "mrkdwn", text: recap.summary } },
          ...(top ? [{ type: "section", text: { type: "mrkdwn", text: `*Top posts*\n${top}` } }] : []),
          ...(people ? [{ type: "section", text: { type: "mrkdwn", text: `*Who posted*\n${people}` } }] : []),
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open recap" }, url: `${siteUrl()}/recap` }] },
        ],
        unfurl_links: false,
      },
    );
    await ctx.runMutation(internal.recaps.markSent, args);
  },
});

export const claimForEmail = internalMutation({
  args: { workspaceId: v.id("workspaces"), email: v.string(), ideaId: v.id("ideas"), slackUserId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: true; draftId: Id<"drafts"> } | { ok: false; message: string }> => {
    const member = (
      await ctx.db
        .query("members")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).find((row) => row.email?.toLowerCase() === args.email.toLowerCase());
    if (!member) return { ok: false, message: `No opentopost member uses ${args.email}. Ask an owner to invite you.` };
    if (args.slackUserId && member.slackUserId !== args.slackUserId) await ctx.db.patch(member._id, { slackUserId: args.slackUserId });
    try {
      const draftId = await claimIdea(ctx, { member, via: "slack" }, args.ideaId);
      return { ok: true, draftId };
    } catch (error) {
      return { ok: false, message: error instanceof ConvexError ? String(error.data) : "The claim failed. Try again." };
    }
  },
});

export const handleClaim = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), ideaId: v.string(), responseUrl: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const reply = (text: string) =>
      fetch(args.responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
      });
    const target = await ctx.runQuery(internal.slack.connectionForTeam, { teamId: args.teamId });
    if (!target) return void (await reply("This Slack workspace is not connected to opentopost."));
    const conn = await token(ctx, target.workspaceId);
    if (!conn) return void (await reply("This Slack workspace is not connected to opentopost."));
    const ideaId = args.ideaId as Id<"ideas">;
    let email: string | undefined;
    try {
      const info = await slackApi<{ user: { profile?: { email?: string } } }>("users.info", conn.token, { user: args.slackUserId });
      email = info.user.profile?.email;
    } catch {
      email = undefined;
    }
    if (!email) return void (await reply("opentopost could not read your Slack email."));
    const result = await ctx.runMutation(internal.slack.claimForEmail, {
      workspaceId: target.workspaceId,
      email,
      ideaId,
      slackUserId: args.slackUserId,
    });
    await reply(
      result.ok
        ? "Your draft is being written in your voice. It will arrive in a direct message from opentopost in about 20 seconds."
        : result.message,
    );
  },
});

/** Tells the author in the ideas channel that a scheduled post is due. */
export const notifyDue = internalAction({
  args: { workspaceId: v.id("workspaces"), email: v.optional(v.string()), title: v.string(), draftId: v.id("drafts"), company: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const conn = await token(ctx, args.workspaceId);
    if (!conn?.config.ideasChannel) return;
    let mention = "";
    if (args.email) {
      try {
        const found = await slackApi<{ user: { id: string } }>("users.lookupByEmail", conn.token, { email: args.email });
        mention = `<@${found.user.id}> `;
      } catch {
        mention = "";
      }
    }
    const where = args.company ? "the company page" : "LinkedIn";
    await slackApi(
      "chat.postMessage",
      conn.token,
      {},
      {
        channel: conn.config.ideasChannel.id,
        text: `${mention}It is time to post "${args.title}" on ${where}.`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `${mention}It is time to post *${args.title}* on ${where}.` } },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                style: "primary",
                text: { type: "plain_text", text: "Open the draft" },
                action_id: "open",
                url: `${siteUrl()}/drafts/${args.draftId}`,
              },
            ],
          },
        ],
        unfurl_links: false,
      },
    );
  },
});

/* ------------------------------------------------------------------------ */
/* The draft loop in Slack: each draft arrives as a direct message with      */
/* buttons to approve and schedule, edit, or pass. Replying in the thread    */
/* asks for a change.                                                         */

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn post",
  x: "X post",
  changelog: "Changelog entry",
  investor_update: "Investor update",
  newsletter: "Newsletter section",
};

export const draftForSlack = internalQuery({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    const member = await ctx.db.get(draft.memberId);
    const thread = await ctx.db
      .query("slackDrafts")
      .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
      .first();
    return { draft, member, thread };
  },
});

export const saveThread = internalMutation({
  args: { draftId: v.id("drafts"), teamId: v.string(), channelId: v.string(), ts: v.string(), memberId: v.id("members"), slackUserId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("slackDrafts", { draftId: args.draftId, teamId: args.teamId, channelId: args.channelId, ts: args.ts });
    const member = await ctx.db.get(args.memberId);
    if (member && member.slackUserId !== args.slackUserId) await ctx.db.patch(member._id, { slackUserId: args.slackUserId });
  },
});

function draftBlocks(draft: Doc<"drafts">, note?: string) {
  const hook = draft.hook ?? draft.hooks[0] ?? "";
  const text = `${hook ? `*${hook}*\n\n` : ""}${draft.body}`.slice(0, 2900);
  const unsupported = openClaims(draft).length;
  const checks = draft.claims
    ? unsupported
      ? `:warning: ${unsupported} claim${unsupported === 1 ? " has" : "s have"} no source. Click *Fix it* to remove ${unsupported === 1 ? "it" : "them"} before you approve.`
      : `:white_check_mark: Every claim links to a source.`
    : "";
  const label = CHANNEL_LABEL[draft.channel ?? "linkedin"] ?? "Post";
  const scheduled = draft.schedule?.state === "scheduled";
  return [
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `*${label}${draft.voice === "company" ? " for the company page" : ""}* · ${draft.title}` }],
    },
    { type: "section", text: { type: "mrkdwn", text } },
    ...(checks ? [{ type: "context", elements: [{ type: "mrkdwn", text: checks }] }] : []),
    ...(note ? [{ type: "context", elements: [{ type: "mrkdwn", text: note }] }] : []),
    {
      type: "actions",
      elements: scheduled
        ? [{ type: "button", text: { type: "plain_text", text: "Open in opentopost" }, action_id: "open", url: `${siteUrl()}/drafts/${draft._id}` }]
        : [
            unsupported
              ? { type: "button", style: "primary", text: { type: "plain_text", text: "Fix it" }, action_id: "draft_fix", value: draft._id }
              : {
                  type: "button",
                  style: "primary",
                  text: { type: "plain_text", text: "Approve and schedule" },
                  action_id: "draft_approve",
                  value: draft._id,
                },
            { type: "button", text: { type: "plain_text", text: "Edit" }, action_id: "draft_edit", value: draft._id },
            { type: "button", text: { type: "plain_text", text: "Pass" }, action_id: "draft_pass", value: draft._id },
            { type: "button", text: { type: "plain_text", text: "Open" }, action_id: "open", url: `${siteUrl()}/drafts/${draft._id}` },
          ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "Reply here to ask for a change, for example: _shorter, and lead with the result_." }] },
  ];
}

/** Sends a finished draft to its author as a direct message. Skips teams without Slack. */
export const sendDraft = internalAction({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args): Promise<void> => {
    const found = await ctx.runQuery(internal.slack.draftForSlack, args);
    if (!found || !found.member || found.draft.status !== "ready") return;
    if (found.thread) {
      await ctx.runAction(internal.slack.updateDraftMessage, args);
      return;
    }
    const conn = await token(ctx, found.draft.workspaceId);
    if (!conn) {
      console.warn(`Slack draft DM skipped for ${args.draftId}: Slack is not connected.`);
      return;
    }
    let slackUserId = found.member.slackUserId;
    if (!slackUserId && found.member.email) {
      try {
        const user = await slackApi<{ user: { id: string } }>("users.lookupByEmail", conn.token, { email: found.member.email });
        slackUserId = user.user.id;
      } catch (error) {
        console.warn(`Slack draft DM skipped for ${args.draftId}: no Slack user with ${found.member.email} (${errorText(error)}).`);
        return;
      }
    }
    if (!slackUserId) {
      console.warn(`Slack draft DM skipped for ${args.draftId}: the member has no email.`);
      return;
    }
    try {
      const dm = await slackApi<{ channel: { id: string } }>("conversations.open", conn.token, {}, { users: slackUserId });
      const posted = await slackApi<{ ts: string; channel: string }>(
        "chat.postMessage",
        conn.token,
        {},
        {
          channel: dm.channel.id,
          text: `Your draft is ready: ${found.draft.title}`,
          blocks: draftBlocks(found.draft),
          unfurl_links: false,
        },
      );
      await ctx.runMutation(internal.slack.saveThread, {
        draftId: found.draft._id,
        teamId: conn.config.teamId,
        channelId: posted.channel,
        ts: posted.ts,
        memberId: found.member._id,
        slackUserId,
      });
    } catch (error) {
      // Workspaces installed before direct messages were added need to reinstall the Slack app.
      console.warn(`Slack draft DM failed for ${args.draftId}: ${errorText(error)}`);
    }
  },
});

/** Refreshes the draft's Slack message after a change, and says so in the thread. */
export const updateDraftMessage = internalAction({
  args: { draftId: v.id("drafts"), note: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const found = await ctx.runQuery(internal.slack.draftForSlack, { draftId: args.draftId });
    if (!found?.thread) {
      if (found?.draft.status === "ready") await ctx.runAction(internal.slack.sendDraft, { draftId: args.draftId });
      return;
    }
    const conn = await token(ctx, found.draft.workspaceId);
    if (!conn) return;
    try {
      await slackApi(
        "chat.update",
        conn.token,
        {},
        {
          channel: found.thread.channelId,
          ts: found.thread.ts,
          text: found.draft.title,
          blocks: draftBlocks(found.draft, args.note),
        },
      );
      if (args.note) {
        await slackApi("chat.postMessage", conn.token, {}, { channel: found.thread.channelId, thread_ts: found.thread.ts, text: args.note });
      }
    } catch {
      // The message may have been deleted in Slack.
    }
  },
});

export const memberForSlack = internalQuery({
  args: { workspaceId: v.id("workspaces"), slackUserId: v.string() },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return members.find((member) => member.slackUserId === args.slackUserId) ?? null;
  },
});

/** The draft for a thread, or the latest draft sent to this DM when there is no thread. */
export const threadDraft = internalQuery({
  args: { teamId: v.string(), channelId: v.string(), ts: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ts = args.ts;
    const row = ts
      ? await ctx.db
          .query("slackDrafts")
          .withIndex("by_thread", (q) => q.eq("teamId", args.teamId).eq("channelId", args.channelId).eq("ts", ts))
          .first()
      : await ctx.db
          .query("slackDrafts")
          .withIndex("by_thread", (q) => q.eq("teamId", args.teamId).eq("channelId", args.channelId))
          .order("desc")
          .first();
    if (!row) return null;
    const draft = await ctx.db.get(row.draftId);
    return draft ? { draft, ts: row.ts } : null;
  },
});

/** Runs one Slack action on a draft as the member who clicked. */
export const actOnDraft = internalMutation({
  args: {
    memberId: v.id("members"),
    draftId: v.id("drafts"),
    action: v.union(v.literal("approve"), v.literal("pass"), v.literal("revise"), v.literal("edit")),
    text: v.optional(v.string()),
    hook: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const member = await ctx.db.get(args.memberId);
    const draft = await ctx.db.get(args.draftId);
    if (!member || !draft) return { ok: false, message: "This draft no longer exists." };
    const actor: Actor = { member, via: "slack" };
    if (!canEditDraft(member, draft)) return { ok: false, message: "Only the author can change this draft." };
    try {
      if (args.action === "pass") {
        await passDraft(ctx, actor, draft);
        return { ok: true, message: "Passed. The idea is free for someone else." };
      }
      if (args.action === "revise") {
        await reviseDraft(ctx, actor, draft, args.text ?? "");
        return { ok: true, message: "Rewriting with your change. The draft above updates in about 20 seconds." };
      }
      if (args.action === "edit") {
        await editDraft(ctx, actor, draft, args.hook ?? draft.hook ?? "", args.text ?? draft.body);
        return { ok: true, message: "Saved your edit." };
      }
      requireSourcedClaims(draft);
      const ent = await entitlementsFor(ctx, draft.workspaceId);
      if ((await reviewNeeded(ctx, draft, ent.features.review)) && draft.reviewState !== "approved") {
        if (draft.reviewState !== "pending") await askForReview(ctx, actor, draft, true);
        return { ok: true, message: "Sent to your reviewers. It is scheduled once they approve it." };
      }
      const result = await scheduleDraft(ctx, actor, draft, { reviewFeature: ent.features.review, linkedinReady: linkedinConfigured() });
      const author = draft.voice === "company" ? null : await ctx.db.get(draft.memberId);
      const zone = author?.timezone ?? (await ctx.db.get(draft.workspaceId))?.timezone ?? "UTC";
      const when = new Date(result.at).toLocaleString("en-GB", { timeZone: zone, weekday: "long", hour: "2-digit", minute: "2-digit" });
      return {
        ok: true,
        message:
          result.mode === "publish" ? `Approved. It publishes to your LinkedIn on ${when}.` : `Approved. You get a reminder to post it on ${when}.`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof ConvexError ? String(error.data) : "That did not work. Try again in opentopost." };
    }
  },
});

async function slackMember(ctx: ActionCtx, teamId: string, slackUserId: string) {
  const target = await ctx.runQuery(internal.slack.connectionForTeam, { teamId });
  if (!target) return null;
  const conn = await token(ctx, target.workspaceId);
  if (!conn) return null;
  let member = await ctx.runQuery(internal.slack.memberForSlack, { workspaceId: target.workspaceId, slackUserId });
  if (!member) {
    try {
      const info = await slackApi<{ user: { profile?: { email?: string } } }>("users.info", conn.token, { user: slackUserId });
      const email = info.user.profile?.email?.toLowerCase();
      if (email) member = await ctx.runQuery(internal.slack.memberByEmail, { workspaceId: target.workspaceId, email });
    } catch {
      member = null;
    }
  }
  return member ? { member, conn } : null;
}

export const memberByEmail = internalQuery({
  args: { workspaceId: v.id("workspaces"), email: v.string() },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("members")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).find((member) => member.email?.toLowerCase() === args.email) ?? null,
});

/** Button clicks on a draft message: approve, edit (opens a form), or pass. */
export const handleDraftAction = internalAction({
  args: {
    teamId: v.string(),
    slackUserId: v.string(),
    action: v.string(),
    draftId: v.string(),
    triggerId: v.optional(v.string()),
    responseUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const reply = async (text: string) => {
      if (!args.responseUrl) return;
      await fetch(args.responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
      });
    };
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return void (await reply("opentopost does not know your Slack account. Ask an owner to invite you with your Slack email."));
    const draftId = args.draftId as Id<"drafts">;
    if (args.action === "edit") {
      const data = await ctx.runQuery(internal.slack.draftForSlack, { draftId });
      if (!data || !args.triggerId) return;
      if (!canEditDraft(found.member, data.draft)) return void (await reply("Only the author can change this draft."));
      await slackApi(
        "views.open",
        found.conn.token,
        {},
        {
          trigger_id: args.triggerId,
          view: {
            type: "modal",
            callback_id: "draft_edit",
            private_metadata: draftId,
            title: { type: "plain_text", text: "Edit draft" },
            submit: { type: "plain_text", text: "Save" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "input",
                block_id: "hook",
                label: { type: "plain_text", text: "Hook" },
                element: { type: "plain_text_input", action_id: "value", initial_value: data.draft.hook ?? data.draft.hooks[0] ?? "" },
              },
              {
                type: "input",
                block_id: "body",
                label: { type: "plain_text", text: "Body" },
                element: { type: "plain_text_input", action_id: "value", multiline: true, initial_value: data.draft.body.slice(0, 2900) },
              },
            ],
          },
        },
      );
      return;
    }
    if (args.action === "fix") {
      const result = await ctx.runMutation(internal.slack.actOnDraft, {
        memberId: found.member._id,
        draftId,
        action: "revise",
        text: "Remove or reword every claim that has no source. Change nothing else.",
      });
      await ctx.runAction(internal.slack.updateDraftMessage, {
        draftId,
        note: result.ok ? "Removing the claims without a source. This message updates in about 20 seconds." : result.message,
      });
      return;
    }
    const action = args.action === "approve" ? "approve" : "pass";
    const result = await ctx.runMutation(internal.slack.actOnDraft, { memberId: found.member._id, draftId, action });
    if (result.ok && action === "approve") await ctx.runAction(internal.slack.updateDraftMessage, { draftId, note: result.message });
    else if (result.ok && action === "pass") await reply(result.message);
    else await reply(result.message);
  },
});

/** The edit form was saved. */
export const handleEditSubmit = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), draftId: v.string(), hook: v.string(), body: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return;
    const draftId = args.draftId as Id<"drafts">;
    const result = await ctx.runMutation(internal.slack.actOnDraft, {
      memberId: found.member._id,
      draftId,
      action: "edit",
      hook: args.hook,
      text: args.body,
    });
    await ctx.runAction(internal.slack.updateDraftMessage, { draftId, note: result.message });
  },
});

/** A reply in a draft's thread asks for a change. */
export const handleThreadReply = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), channelId: v.string(), threadTs: v.optional(v.string()), text: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const thread = await ctx.runQuery(internal.slack.threadDraft, { teamId: args.teamId, channelId: args.channelId, ts: args.threadTs });
    if (!thread) return;
    const { draft, ts: threadTs } = thread;
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return;
    const result = await ctx.runMutation(internal.slack.actOnDraft, {
      memberId: found.member._id,
      draftId: draft._id,
      action: "revise",
      text: args.text,
    });
    try {
      await slackApi("chat.postMessage", found.conn.token, {}, { channel: args.channelId, thread_ts: threadTs, text: result.message });
    } catch {
      // Nothing else to do.
    }
  },
});

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}


/* ----------------------------------------------------------------------------
 * Review and personal-recap direct messages.
 * Reviewers get a DM when a draft needs them, with Approve and Send back.
 * Authors get a DM when their draft is approved or sent back.
 * On Friday each person gets their own week in a DM.
 * ------------------------------------------------------------------------- */

type Conn = NonNullable<Awaited<ReturnType<typeof token>>>;

export const rememberSlackUser = internalMutation({
  args: { memberId: v.id("members"), slackUserId: v.string() },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (member && member.slackUserId !== args.slackUserId) await ctx.db.patch(member._id, { slackUserId: args.slackUserId });
  },
});

/** Opens a DM with a member, finding their Slack user by email the first time. Returns the channel id, or null. */
async function dmChannel(ctx: ActionCtx, conn: Conn, member: Doc<"members">): Promise<string | null> {
  let slackUserId = member.slackUserId;
  if (!slackUserId && member.email) {
    try {
      slackUserId = (await slackApi<{ user: { id: string } }>("users.lookupByEmail", conn.token, { email: member.email })).user.id;
      await ctx.runMutation(internal.slack.rememberSlackUser, { memberId: member._id, slackUserId });
    } catch {
      return null;
    }
  }
  if (!slackUserId) return null;
  try {
    return (await slackApi<{ channel: { id: string } }>("conversations.open", conn.token, {}, { users: slackUserId })).channel.id;
  } catch (error) {
    console.warn(`Slack DM to ${member._id} failed: ${errorText(error)}`);
    return null;
  }
}

async function dm(ctx: ActionCtx, conn: Conn, member: Doc<"members">, text: string, blocks: unknown[]) {
  const channel = await dmChannel(ctx, conn, member);
  if (!channel) return false;
  try {
    await slackApi("chat.postMessage", conn.token, {}, { channel, text, blocks, unfurl_links: false });
    return true;
  } catch (error) {
    console.warn(`Slack DM to ${member._id} failed: ${errorText(error)}`);
    return false;
  }
}

const excerpt = (draft: Doc<"drafts">, max = 400) => {
  const text = `${draft.hook ?? draft.hooks[0] ?? ""}\n\n${draft.body}`.trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

export const reviewNotice = internalQuery({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    const author = await ctx.db.get(draft.memberId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", draft.workspaceId))
      .collect();
    const all = members.filter((member) => isReviewer(member.role) && !member.kindeUserId.startsWith("demo:"));
    const others = all.filter((member) => member._id !== draft.memberId);
    const reviewer = draft.review?.reviewerId ? await ctx.db.get(draft.review.reviewerId) : null;
    return { draft, author, reviewers: others.length ? others : all, reviewer };
  },
});

/** Sends the review DMs: to reviewers when a draft needs them, and to the author when it is decided. */
export const notifyReview = internalAction({
  args: { draftId: v.id("drafts"), kind: v.union(v.literal("requested"), v.literal("approved"), v.literal("changes")) },
  handler: async (ctx, args): Promise<void> => {
    const found = await ctx.runQuery(internal.slack.reviewNotice, { draftId: args.draftId });
    if (!found || !found.author) return;
    const conn = await token(ctx, found.draft.workspaceId);
    if (!conn) return;
    const { draft, author, reviewer } = found;
    const open = { type: "button", text: { type: "plain_text", text: "Open draft" }, url: `${siteUrl()}/drafts/${draft._id}`, action_id: "review_open" };
    if (args.kind === "requested") {
      const company = draft.voice === "company";
      for (const person of found.reviewers) {
        await dm(ctx, conn, person, `Review needed: ${draft.title}`, [
          { type: "section", text: { type: "mrkdwn", text: `*Review needed* · ${company ? "Company page post" : `${author.name}'s post`}\n*${draft.title}*` } },
          { type: "section", text: { type: "mrkdwn", text: `>${excerpt(draft).replace(/\n/g, "\n>")}` } },
          {
            type: "actions",
            elements: [
              { type: "button", style: "primary", text: { type: "plain_text", text: "Approve" }, action_id: "review_approve", value: draft._id },
              { type: "button", text: { type: "plain_text", text: "Send back" }, action_id: "review_back", value: draft._id },
              open,
            ],
          },
        ]);
      }
      return;
    }
    const by = reviewer?.name ?? "A reviewer";
    if (args.kind === "approved") {
      await dm(ctx, conn, author, `${by} approved ${draft.title}`, [
        { type: "section", text: { type: "mrkdwn", text: `*${by} approved your draft* · ${draft.title}\nApprove it in its message above, or schedule it in the app, and it goes out at your posting time.` } },
        { type: "actions", elements: [open] },
      ]);
    } else {
      const comment = draft.review?.comment ? `\n>${draft.review.comment.replace(/\n/g, "\n>")}` : "";
      await dm(ctx, conn, author, `${by} sent back ${draft.title}`, [
        { type: "section", text: { type: "mrkdwn", text: `*${by} sent your draft back* · ${draft.title}${comment}\nReply in the draft's thread with what to change, or edit it in the app, then ask for review again.` } },
        { type: "actions", elements: [open] },
      ]);
    }
    await ctx.runAction(internal.slack.updateDraftMessage, { draftId: draft._id });
  },
});

export const reviewDecide = internalMutation({
  args: { memberId: v.id("members"), draftId: v.string(), approve: v.boolean(), comment: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const member = await ctx.db.get(args.memberId);
    const draftId = ctx.db.normalizeId("drafts", args.draftId);
    const draft = draftId ? await ctx.db.get(draftId) : null;
    if (!member || !draft || draft.workspaceId !== member.workspaceId) return { ok: false, message: "This draft no longer exists." };
    try {
      await decideReview(ctx, { member, via: "slack" }, draft, args.approve, args.comment);
      return { ok: true, message: args.approve ? `Approved: ${draft.title}. The author has been told.` : `Sent back: ${draft.title}. The author has your note.` };
    } catch (error) {
      return { ok: false, message: error instanceof ConvexError ? String(error.data) : "That did not work. Open the draft in the app." };
    }
  },
});

export const handleReviewAction = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), action: v.string(), draftId: v.string(), triggerId: v.optional(v.string()), responseUrl: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const reply = async (text: string, replace = false) => {
      if (!args.responseUrl) return;
      await fetch(args.responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replace ? { replace_original: true, text } : { response_type: "ephemeral", replace_original: false, text }),
      });
    };
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return void (await reply("opentopost does not know your Slack account. Ask an owner to invite you with your Slack email."));
    if (args.action === "back") {
      if (!args.triggerId) return;
      await slackApi("views.open", found.conn.token, {}, {
        trigger_id: args.triggerId,
        view: {
          type: "modal",
          callback_id: "review_back",
          private_metadata: args.draftId,
          title: { type: "plain_text", text: "Send back" },
          submit: { type: "plain_text", text: "Send back" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            { type: "input", block_id: "comment", label: { type: "plain_text", text: "What should change?" }, element: { type: "plain_text_input", action_id: "value", multiline: true } },
          ],
        },
      });
      return;
    }
    if (args.action !== "approve") return;
    const result = await ctx.runMutation(internal.slack.reviewDecide, { memberId: found.member._id, draftId: args.draftId, approve: true });
    await reply(result.ok ? `✅ ${result.message}` : result.message, result.ok);
  },
});

export const handleReviewBack = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), draftId: v.string(), comment: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return;
    const result = await ctx.runMutation(internal.slack.reviewDecide, { memberId: found.member._id, draftId: args.draftId, approve: false, comment: args.comment });
    if (!result.ok) {
      const channel = await dmChannel(ctx, found.conn, found.member);
      if (channel) await slackApi("chat.postMessage", found.conn.token, {}, { channel, text: result.message });
    }
  },
});

/** Each person's Friday DM: their week, and one untold moment they can turn into a draft. */
export const personalRecaps = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    const conn = await token(ctx, args.workspaceId);
    if (!conn) return;
    for (const memberId of await ctx.runQuery(internal.personal.membersOf, args)) {
      const found = await ctx.runQuery(internal.personal.weekForMember, { memberId });
      if (!found) continue;
      const { member, week } = found;
      if (week.shipped === 0 && week.posted === 0 && week.untold.length === 0) continue;
      const first = member.name.split(" ")[0];
      const lines = [
        `*Your week, ${first}*`,
        `Shipped: *${week.shipped}* · Posted: *${week.posted} of ${week.goal}*`,
        week.last30.posts ? `Last 30 days: ${week.last30.posts} posts, ${week.last30.clicks} clicks, ${week.last30.conversions} signups` : "",
        week.waiting.sentBack.length ? `${week.waiting.sentBack.length} draft${week.waiting.sentBack.length === 1 ? "" : "s"} sent back to you` : "",
        week.waiting.ready.length ? `${week.waiting.ready.length} draft${week.waiting.ready.length === 1 ? "" : "s"} ready to approve` : "",
      ].filter(Boolean);
      const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
      const top = week.untold[0];
      if (top) {
        blocks.push(
          { type: "section", text: { type: "mrkdwn", text: `*Not told yet*\n${top.title}` } },
          {
            type: "actions",
            elements: [
              { type: "button", style: "primary", text: { type: "plain_text", text: "Write my draft" }, action_id: "moment_draft", value: top.momentId },
              { type: "button", text: { type: "plain_text", text: "Open your week" }, url: `${siteUrl()}/dashboard`, action_id: "week_open" },
            ],
          },
        );
      }
      await dm(ctx, conn, member, `Your week: shipped ${week.shipped}, posted ${week.posted} of ${week.goal}`, blocks);
    }
  },
});

export const draftMomentFor = internalMutation({
  args: { memberId: v.id("members"), momentId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const member = await ctx.db.get(args.memberId);
    const momentId = ctx.db.normalizeId("moments", args.momentId);
    if (!member || !momentId) return { ok: false, message: "This moment no longer exists." };
    try {
      await draftFromMoment(ctx, { member, via: "slack" }, momentId, "linkedin", false);
      return { ok: true, message: "Writing it now in your voice. The draft arrives here in about a minute." };
    } catch (error) {
      return { ok: false, message: error instanceof ConvexError ? String(error.data) : "That did not work. Open the moment in the app." };
    }
  },
});

export const handleMomentDraft = internalAction({
  args: { teamId: v.string(), slackUserId: v.string(), momentId: v.string(), responseUrl: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const reply = async (text: string) => {
      if (!args.responseUrl) return;
      await fetch(args.responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
      });
    };
    const found = await slackMember(ctx, args.teamId, args.slackUserId);
    if (!found) return void (await reply("opentopost does not know your Slack account."));
    const result = await ctx.runMutation(internal.slack.draftMomentFor, { memberId: found.member._id, momentId: args.momentId });
    await reply(result.message);
  },
});
