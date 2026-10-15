import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { isPrivateHost } from "./lib/safeFetch";
import { audit, WEBHOOK_EVENTS } from "./lib/ops";

/*
 * Outbound webhooks. Each delivery is a POST with a JSON body and an
 * X-Opentopost-Signature header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}`>"
 * using the webhook's signing secret.
 */

function validUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ConvexError("Enter a full https:// address.");
  }
  if (url.protocol !== "https:") throw new ConvexError("Webhook addresses must use https.");
  if (process.env.DEPLOYMENT_MODE === "hosted" && isPrivateHost(url.hostname)) {
    throw new ConvexError("Private and local addresses are not allowed on the hosted version.");
  }
  return url.toString();
}

const eventArg = v.array(v.string());

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("webhooks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return {
      events: [...WEBHOOK_EVENTS],
      webhooks: rows.map((row) => ({
        _id: row._id,
        url: row.url,
        events: row.events,
        enabled: row.enabled,
        createdAt: row.createdAt,
        lastStatus: row.lastStatus ?? null,
        lastAt: row.lastAt ?? null,
        lastError: row.lastError ?? null,
      })),
    };
  },
});

/** Creates a webhook and returns its signing secret once. */
export const create = action({
  args: { workspaceId: v.id("workspaces"), url: v.string(), events: eventArg },
  handler: async (ctx, args): Promise<{ secret: string }> => {
    const url = validUrl(args.url);
    const events = args.events.filter((event) => (WEBHOOK_EVENTS as readonly string[]).includes(event));
    if (events.length === 0) throw new ConvexError("Choose at least one event.");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = `whsec_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const sealed = await encrypt(secret);
    await ctx.runMutation(internal.webhooks.insert, { workspaceId: args.workspaceId, url, events, ...sealed });
    return { secret };
  },
});

export const insert = internalMutation({
  args: { workspaceId: v.id("workspaces"), url: v.string(), events: eventArg, ciphertext: v.string(), iv: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const count = (
      await ctx.db
        .query("webhooks")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).length;
    if (count >= 10) throw new ConvexError("A workspace can have up to 10 webhooks.");
    await ctx.db.insert("webhooks", { ...args, enabled: true, createdAt: Date.now() });
    await audit(ctx, args.workspaceId, { member: owner, via: "app" }, "webhook.created", args.url, args.events.join(", "));
  },
});

export const setEnabled = mutation({
  args: { webhookId: v.id("webhooks"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.webhookId);
    if (!hook) return;
    const owner = await requireOwner(ctx, hook.workspaceId);
    await ctx.db.patch(hook._id, { enabled: args.enabled });
    await audit(ctx, hook.workspaceId, { member: owner, via: "app" }, args.enabled ? "webhook.enabled" : "webhook.disabled", hook.url);
  },
});

export const remove = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.webhookId);
    if (!hook) return;
    const owner = await requireOwner(ctx, hook.workspaceId);
    await ctx.db.delete(hook._id);
    await audit(ctx, hook.workspaceId, { member: owner, via: "app" }, "webhook.deleted", hook.url);
  },
});

/** Sends a test event to one webhook. */
export const test = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.webhookId);
    if (!hook) return;
    await requireOwner(ctx, hook.workspaceId);
    await ctx.scheduler.runAfter(0, internal.webhooks.deliver, {
      webhookId: hook._id,
      event: "test",
      payload: JSON.stringify({ event: "test", workspaceId: hook.workspaceId, at: new Date().toISOString(), data: { ok: true } }),
    });
  },
});

export const forDelivery = internalQuery({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => ctx.db.get(args.webhookId),
});

export const recordResult = internalMutation({
  args: { webhookId: v.id("webhooks"), status: v.number(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.webhookId))) return;
    await ctx.db.patch(args.webhookId, { lastStatus: args.status, lastAt: Date.now(), lastError: args.error });
  },
});

async function sign(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Delivers one event, retrying with backoff up to 5 times. */
export const deliver = internalAction({
  args: { webhookId: v.id("webhooks"), event: v.string(), payload: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, args): Promise<void> => {
    const hook = await ctx.runQuery(internal.webhooks.forDelivery, { webhookId: args.webhookId });
    if (!hook || !hook.enabled) return;
    const attempt = args.attempt ?? 1;
    const secret = await decrypt(hook.ciphertext, hook.iv);
    const timestamp = String(Math.floor(Date.now() / 1000));
    let status = 0;
    let error: string | undefined;
    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "opentopost-webhooks/1",
          "X-Opentopost-Event": args.event,
          "X-Opentopost-Signature": `t=${timestamp},v1=${await sign(secret, timestamp, args.payload)}`,
        },
        body: args.payload,
        // Never follow a redirect: it could point the signed payload at another host.
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
      if (response.status >= 300 && response.status < 400) error = `The endpoint redirected (${response.status}). Use the final address.`;
      else if (!response.ok) error = `The endpoint answered ${response.status}.`;
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 200) : "The request failed.";
    }
    await ctx.runMutation(internal.webhooks.recordResult, { webhookId: hook._id, status, error });
    if (error && attempt < 5) {
      await ctx.scheduler.runAfter(30_000 * 2 ** attempt, internal.webhooks.deliver, { ...args, attempt: attempt + 1 });
    }
  },
});
