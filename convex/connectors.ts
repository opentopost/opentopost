import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { isManager, requireMember, requireOwner } from "./lib/auth";
import { CONNECTORS, CONNECTOR_KINDS, type ConnectorKind } from "./lib/connectorTypes";
import {
  fetchDrive,
  fetchIntercom,
  fetchJira,
  fetchLinear,
  fetchNotion,
  fetchRss,
  fetchZendesk,
  testDrive,
  testIntercom,
  testJira,
  testLinear,
  testNotion,
  testRss,
  testZendesk,
  type Item,
  type Values,
} from "./lib/connectors";
import { decrypt, encrypt } from "./lib/crypto";
import { deploymentMode } from "./lib/limits";
import { entitlementsFor } from "./lib/plan";
import { countedSources, sourceLimitMessage } from "./sources";

const LOOKBACK = 14 * 24 * 60 * 60 * 1000;
const kindValidator = v.union(...CONNECTOR_KINDS.map((kind) => v.literal(kind)));

type ConnectorConfig = { kind: ConnectorKind; settings: Values; lastSyncedAt?: number; lastError?: string };

const isConnector = (source: Doc<"sources">) => (CONNECTOR_KINDS as readonly string[]).includes(source.type);

function readerEmail(): string | null {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    return raw ? ((JSON.parse(raw) as { client_email?: string }).client_email ?? null) : null;
  } catch {
    return null;
  }
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const sources = (
      await ctx.db
        .query("sources")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).filter(isConnector);
    return {
      canEdit: isManager(member.role),
      driveReader: readerEmail(),
      connected: sources.map((source) => {
        const config = source.config as ConnectorConfig;
        return {
          _id: source._id,
          kind: config.kind,
          settings: config.settings,
          enabled: source.enabled,
          lastSyncedAt: config.lastSyncedAt ?? null,
          lastError: config.lastError ?? null,
        };
      }),
    };
  },
});

export const checkCanAdd = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const { limits, plan } = await entitlementsFor(ctx, args.workspaceId);
    if ((await countedSources(ctx, args.workspaceId)) >= limits.sources) {
      throw new ConvexError(sourceLimitMessage(plan, limits.sources));
    }
  },
});

async function driveToken(ctx: ActionCtx) {
  return ctx.runAction(internal.googleNode.driveToken, {});
}

async function testConnector(ctx: ActionCtx, kind: ConnectorKind, values: Values): Promise<string> {
  const allowPrivate = deploymentMode() === "selfhosted";
  switch (kind) {
    case "rss":
      return testRss(values, allowPrivate);
    case "linear":
      return testLinear(values);
    case "jira":
      return testJira(values);
    case "notion":
      return testNotion(values);
    case "gdrive":
      return testDrive(values, await driveToken(ctx));
    case "intercom":
      return testIntercom(values);
    case "zendesk":
      return testZendesk(values);
  }
}

async function fetchConnector(ctx: ActionCtx, kind: ConnectorKind, values: Values, since: number): Promise<Item[]> {
  const allowPrivate = deploymentMode() === "selfhosted";
  switch (kind) {
    case "rss":
      return fetchRss(values, since, allowPrivate);
    case "linear":
      return fetchLinear(values, since);
    case "jira":
      return fetchJira(values, since);
    case "notion":
      return fetchNotion(values, since);
    case "gdrive":
      return fetchDrive(values, since, await driveToken(ctx));
    case "intercom":
      return fetchIntercom(values, since);
    case "zendesk":
      return fetchZendesk(values, since);
  }
}

/** Checks the details with the service before anything is saved. Secret fields are encrypted. */
export const add = action({
  args: { workspaceId: v.id("workspaces"), kind: kindValidator, values: v.record(v.string(), v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    await ctx.runQuery(internal.connectors.checkCanAdd, { workspaceId: args.workspaceId });
    const info = CONNECTORS[args.kind];
    if (args.kind === "gdrive" && !readerEmail()) return { ok: false, message: "Google Docs is not set up on this deployment." };
    const values: Values = {};
    for (const field of info.fields) {
      const value = (args.values[field.key] ?? "").trim();
      if (!value && !field.optional) {
        if (field.options) values[field.key] = field.options[0].value;
        else return { ok: false, message: `Fill in ${field.label.toLowerCase()}.` };
      } else {
        if (value.length > 4000) return { ok: false, message: `${field.label} is too long.` };
        if (field.options && value && !field.options.some((option) => option.value === value)) {
          return { ok: false, message: `Choose a ${field.label.toLowerCase()}.` };
        }
        values[field.key] = value;
      }
    }
    let message: string;
    try {
      message = await testConnector(ctx, args.kind, values);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Could not connect." };
    }
    const secret: Values = {};
    const settings: Values = {};
    for (const field of info.fields) {
      if (field.secret) secret[field.key] = values[field.key] ?? "";
      else settings[field.key] = values[field.key] ?? "";
    }
    const sealed = Object.keys(secret).length ? await encrypt(JSON.stringify(secret)) : null;
    await ctx.runMutation(internal.connectors.insert, {
      workspaceId: args.workspaceId,
      kind: args.kind,
      settings,
      secret: sealed ? { ciphertext: sealed.ciphertext, iv: sealed.iv, last4: (Object.values(secret)[0] ?? "").slice(-4) } : undefined,
    });
    return { ok: true, message };
  },
});

export const insert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    kind: kindValidator,
    settings: v.record(v.string(), v.string()),
    secret: v.optional(v.object({ ciphertext: v.string(), iv: v.string(), last4: v.string() })),
  },
  handler: async (ctx, args) => {
    const sourceId = await ctx.db.insert("sources", {
      workspaceId: args.workspaceId,
      type: args.kind,
      config: { kind: args.kind, settings: args.settings } satisfies ConnectorConfig,
      enabled: true,
    });
    if (args.secret) {
      await ctx.db.insert("secrets", { workspaceId: args.workspaceId, kind: "connector", label: sourceId, ...args.secret, testedAt: Date.now(), testOk: true });
    }
    return sourceId;
  },
});

async function secretFor(ctx: QueryCtx, source: Doc<"sources">) {
  return ctx.db
    .query("secrets")
    .withIndex("by_workspace_kind_label", (q) => q.eq("workspaceId", source.workspaceId).eq("kind", "connector").eq("label", source._id))
    .unique();
}

export const forSync = internalQuery({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || !isConnector(source)) return null;
    const secret = await secretFor(ctx, source);
    return {
      source,
      config: source.config as ConnectorConfig,
      secret: secret ? { ciphertext: secret.ciphertext, iv: secret.iv } : null,
    };
  },
});

export const targets = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("sources")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    )
      .filter((source) => source.enabled && isConnector(source))
      .map((source) => source._id),
});

export const saveStatus = internalMutation({
  args: { sourceId: v.id("sources"), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;
    const config = source.config as ConnectorConfig;
    await ctx.db.patch(source._id, {
      config: { ...config, lastError: args.error, ...(args.error ? {} : { lastSyncedAt: Date.now() }) },
    });
  },
});

async function syncOne(ctx: ActionCtx, sourceId: Id<"sources">): Promise<{ ok: boolean; message: string }> {
  const found = await ctx.runQuery(internal.connectors.forSync, { sourceId });
  if (!found) return { ok: false, message: "This source no longer exists." };
  const { source, config } = found;
  try {
    const secret = found.secret ? (JSON.parse(await decrypt(found.secret.ciphertext, found.secret.iv)) as Values) : {};
    const values = { ...config.settings, ...secret };
    const since = Math.max(source.lastScannedAt ?? 0, Date.now() - LOOKBACK);
    const items = (await fetchConnector(ctx, config.kind, values, since)).filter((item) => item.text.length >= 40);
    if (items.length) {
      await ctx.runMutation(internal.sources.saveItems, {
        workspaceId: source.workspaceId,
        sourceId,
        items: items.map((item) => ({ ...item, externalId: item.externalId.slice(0, 300), title: item.title.slice(0, 200) })),
      });
    }
    await ctx.runMutation(internal.connectors.saveStatus, { sourceId });
    return { ok: true, message: `Read ${items.length} ${items.length === 1 ? "item" : "items"}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "The sync failed.";
    await ctx.runMutation(internal.connectors.saveStatus, { sourceId, error: message });
    return { ok: false, message };
  }
}

export const syncNow = action({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const found = await ctx.runQuery(internal.connectors.forSync, args);
    if (!found) return { ok: false, message: "This source no longer exists." };
    await ctx.runQuery(internal.access.check, { workspaceId: found.source.workspaceId, role: "owner" });
    return syncOne(ctx, args.sourceId);
  },
});

/** Runs on every scan. Each connector is read on its own, so one failure does not stop the rest. */
export const ingest = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    for (const sourceId of await ctx.runQuery(internal.connectors.targets, args)) {
      await syncOne(ctx, sourceId);
    }
  },
});

export const setEnabled = mutation({
  args: { sourceId: v.id("sources"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || !isConnector(source)) return;
    await requireOwner(ctx, source.workspaceId);
    await ctx.db.patch(source._id, { enabled: args.enabled });
  },
});

export const remove = mutation({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || !isConnector(source)) return;
    await requireOwner(ctx, source.workspaceId);
    const secret = await secretFor(ctx, source);
    if (secret) await ctx.db.delete(secret._id);
    const items = await ctx.db
      .query("sourceItems")
      .withIndex("by_source_created", (q) => q.eq("sourceId", source._id))
      .take(1000);
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(source._id);
  },
});
