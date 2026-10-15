import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { audit, emit } from "./lib/ops";
import { entitlements } from "./lib/plan";

/*
 * Counts signups and demos from the CRM, without code on the customer's site.
 * Tracked links add utm_content=<slug> to every click. HubSpot stores the landing
 * URL on each new contact, and Attio stores it in an attribute the team names.
 * New contacts count as signups. HubSpot contacts that reach a sales stage count as demos.
 */

const DEMO_STAGES = new Set(["salesqualifiedlead", "opportunity"]);
type Provider = "hubspot" | "attio";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("crmConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.map((row) => ({
      _id: row._id,
      provider: row.provider,
      last4: row.last4,
      attribute: row.attribute ?? null,
      lastSyncedAt: row.lastSyncedAt ?? null,
      lastError: row.lastError ?? null,
      imported: row.imported ?? 0,
    }));
  },
});

async function check(provider: Provider, token: string) {
  const response =
    provider === "hubspot"
      ? await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", { headers: { Authorization: `Bearer ${token}` } })
      : await fetch("https://api.attio.com/v2/self", { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 || response.status === 403) {
    throw new ConvexError(
      provider === "hubspot"
        ? "HubSpot did not accept this token. Use a private app token with the crm.objects.contacts.read scope."
        : "Attio did not accept this key. Use an API key with read access to records.",
    );
  }
  if (!response.ok) throw new ConvexError(`${provider === "hubspot" ? "HubSpot" : "Attio"} answered ${response.status}. Try again.`);
}

export const connect = action({
  args: { workspaceId: v.id("workspaces"), provider: v.union(v.literal("hubspot"), v.literal("attio")), token: v.string(), attribute: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runQuery(internal.access.check, { workspaceId: args.workspaceId, role: "owner" });
    const token = args.token.trim();
    if (token.length < 10) throw new ConvexError("Paste the full token.");
    await check(args.provider, token);
    const sealed = await encrypt(token);
    await ctx.runMutation(internal.crm.save, {
      workspaceId: args.workspaceId,
      provider: args.provider,
      ...sealed,
      last4: token.slice(-4),
      attribute: args.provider === "attio" ? args.attribute?.trim() || "utm_content" : undefined,
    });
    await ctx.scheduler.runAfter(0, internal.crm.sync, { workspaceId: args.workspaceId });
  },
});

export const save = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("hubspot"), v.literal("attio")),
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
    attribute: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    const existing = (
      await ctx.db
        .query("crmConnections")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).find((row) => row.provider === args.provider);
    if (existing) await ctx.db.patch(existing._id, { ...args, lastError: undefined });
    else await ctx.db.insert("crmConnections", { ...args, createdAt: Date.now() });
    await audit(ctx, args.workspaceId, { member: owner, via: "app" }, "crm.connected", args.provider);
  },
});

export const disconnect = mutation({
  args: { connectionId: v.id("crmConnections") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row) return;
    const owner = await requireOwner(ctx, row.workspaceId);
    await ctx.db.delete(row._id);
    await audit(ctx, row.workspaceId, { member: owner, via: "app" }, "crm.disconnected", row.provider);
  },
});

export const syncNow = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    await ctx.scheduler.runAfter(0, internal.crm.sync, { workspaceId: args.workspaceId });
  },
});

export const connections = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) =>
    ctx.db
      .query("crmConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect(),
});

type Found = { externalId: string; slug: string; type: "signup" | "demo"; at: number };

const slugIn = (url?: string | null) => {
  if (!url) return null;
  try {
    const value = new URL(url).searchParams.get("utm_content");
    return value && /^[a-z0-9]{4,16}$/.test(value) ? value : null;
  } catch {
    return null;
  }
};

async function fromHubSpot(token: string, since: number): Promise<Found[]> {
  const found: Found[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: String(since) }] }],
        properties: ["createdate", "hs_analytics_first_url", "hs_analytics_last_url", "lifecyclestage"],
        sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
        limit: 100,
        ...(after ? { after } : {}),
      }),
    });
    if (!response.ok) throw new Error(`HubSpot answered ${response.status}.`);
    const body = (await response.json()) as {
      results: { id: string; properties: Record<string, string | null> }[];
      paging?: { next?: { after: string } };
    };
    for (const contact of body.results) {
      const slug = slugIn(contact.properties.hs_analytics_first_url) ?? slugIn(contact.properties.hs_analytics_last_url);
      if (!slug) continue;
      const created = Date.parse(contact.properties.createdate ?? "") || Date.now();
      found.push({ externalId: `hubspot:contact:${contact.id}`, slug, type: "signup", at: created });
      if (DEMO_STAGES.has(contact.properties.lifecyclestage ?? "")) {
        found.push({ externalId: `hubspot:contact:${contact.id}:demo`, slug, type: "demo", at: Date.now() });
      }
    }
    after = body.paging?.next?.after;
    if (!after) break;
  }
  return found;
}

async function fromAttio(token: string, attribute: string, since: number): Promise<Found[]> {
  const response = await fetch("https://api.attio.com/v2/objects/people/records/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sorts: [{ attribute: "created_at", direction: "desc" }], limit: 500 }),
  });
  if (!response.ok) throw new Error(`Attio answered ${response.status}.`);
  const body = (await response.json()) as {
    data: { id: { record_id: string }; created_at: string; values: Record<string, { value?: string }[]> }[];
  };
  const found: Found[] = [];
  for (const record of body.data) {
    const at = Date.parse(record.created_at);
    if (at < since) continue;
    const raw = record.values[attribute]?.[0]?.value ?? "";
    const slug = /^[a-z0-9]{4,16}$/.test(raw) ? raw : slugIn(raw);
    if (slug) found.push({ externalId: `attio:person:${record.id.record_id}`, slug, type: "signup", at });
  }
  return found;
}

export const sync = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    const rows = await ctx.runQuery(internal.crm.connections, args);
    for (const row of rows) {
      const since = (row.lastSyncedAt ?? row.createdAt - 30 * 24 * 60 * 60 * 1000) - 10 * 60 * 1000;
      try {
        const token = await decrypt(row.ciphertext, row.iv);
        const found = row.provider === "hubspot" ? await fromHubSpot(token, since) : await fromAttio(token, row.attribute ?? "utm_content", since);
        await ctx.runMutation(internal.crm.record, { connectionId: row._id, found, error: undefined });
      } catch (error) {
        await ctx.runMutation(internal.crm.record, {
          connectionId: row._id,
          found: [],
          error: error instanceof Error ? error.message.slice(0, 200) : "The sync failed.",
        });
      }
    }
  },
});

export const record = internalMutation({
  args: {
    connectionId: v.id("crmConnections"),
    found: v.array(v.object({ externalId: v.string(), slug: v.string(), type: v.union(v.literal("signup"), v.literal("demo")), at: v.number() })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row) return;
    const workspace = await ctx.db.get(row.workspaceId);
    if (!workspace) return;
    let imported = 0;
    if ((await entitlements(ctx, workspace)).features.conversions) {
      for (const item of args.found) {
        const seen = await ctx.db
          .query("conversions")
          .withIndex("by_external", (q) => q.eq("workspaceId", row.workspaceId).eq("externalId", item.externalId))
          .first();
        if (seen) continue;
        const link = await ctx.db
          .query("trackedLinks")
          .withIndex("by_slug", (q) => q.eq("slug", item.slug))
          .unique();
        if (!link || link.workspaceId !== row.workspaceId) continue;
        await ctx.db.insert("conversions", {
          workspaceId: row.workspaceId,
          trackedLinkId: link._id as Id<"trackedLinks">,
          type: item.type,
          at: item.at,
          externalId: item.externalId,
          source: row.provider,
        });
        await emit(ctx, row.workspaceId, "conversion.created", { type: item.type, source: row.provider, slug: item.slug });
        imported += 1;
      }
    }
    await ctx.db.patch(row._id, {
      lastSyncedAt: args.error ? row.lastSyncedAt : Date.now(),
      lastError: args.error,
      imported: (row.imported ?? 0) + imported,
    });
  },
});

export const syncAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("crmConnections").collect();
    for (const workspaceId of new Set(rows.map((row) => row.workspaceId))) {
      await ctx.scheduler.runAfter(0, internal.crm.sync, { workspaceId });
    }
  },
});
