import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isManager, requireMember, requireOwner } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { deploymentMode } from "./lib/limits";
import { checkServerUrl, isReadTool, McpClient, type McpTool } from "./lib/mcp";
import { entitlementsFor } from "./lib/plan";

const MAX_PULLS = 10;
const MAX_ITEMS_PER_PULL = 50;
const MAX_ITEM_TEXT = 8000;

const toolValidator = v.object({ name: v.string(), description: v.optional(v.string()), readOnly: v.optional(v.boolean()) });

function summarize(tools: McpTool[]) {
  return tools.slice(0, 200).map((tool) => ({
    name: tool.name.slice(0, 120),
    description: tool.description?.slice(0, 300),
    readOnly: isReadTool(tool),
  }));
}

function clientFor(url: string, header?: { name: string; value: string }) {
  const parsed = checkServerUrl(url, deploymentMode() === "selfhosted");
  return new McpClient(parsed, header ? { [header.name]: header.value } : {});
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const servers = await ctx.db
      .query("mcpServers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const { limits } = await entitlementsFor(ctx, args.workspaceId);
    return {
      canEdit: isManager(member.role),
      limit: Number.isFinite(limits.mcpServers) ? limits.mcpServers : null,
      servers: servers.map((server) => ({
        _id: server._id,
        name: server.name,
        url: server.url,
        serverName: server.serverName ?? null,
        enabled: server.enabled,
        hasAuth: Boolean(server.secretId),
        authHeader: server.authHeader ?? null,
        tools: server.tools ?? [],
        pulls: server.pulls ?? [],
        lastSyncedAt: server.lastSyncedAt ?? null,
        lastError: server.lastError ?? null,
      })),
    };
  },
});

export const checkCanAdd = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const count = (
      await ctx.db
        .query("mcpServers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).length;
    const { limits, plan } = await entitlementsFor(ctx, args.workspaceId);
    if (count >= limits.mcpServers) {
      throw new ConvexError(
        plan === "team"
          ? `Your plan allows ${limits.mcpServers} MCP servers. Remove one to add another.`
          : `Your plan allows ${limits.mcpServers} MCP server${limits.mcpServers === 1 ? "" : "s"}. Upgrade in Settings > Billing for more.`,
      );
    }
  },
});

/** Connects to the server and lists its tools before anything is saved. */
export const add = action({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    authHeader: v.optional(v.string()),
    authValue: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string; serverId?: Id<"mcpServers"> }> => {
    await ctx.runQuery(internal.mcp.checkCanAdd, { workspaceId: args.workspaceId });
    const name = args.name.trim();
    if (name.length < 2 || name.length > 40) return { ok: false, message: "Use a name between 2 and 40 characters." };
    const headerName = args.authHeader?.trim() || "Authorization";
    if (!/^[A-Za-z0-9-]{1,64}$/.test(headerName)) return { ok: false, message: "The header name can use letters, numbers, and dashes." };
    const authValue = args.authValue?.trim();
    let tools: McpTool[];
    let serverName: string | null;
    try {
      const client = clientFor(args.url, authValue ? { name: headerName, value: authValue } : undefined);
      serverName = (await client.connect()).name;
      tools = await client.listTools();
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Could not connect to the server." };
    }
    const sealed = authValue ? await encrypt(authValue) : null;
    const serverId = await ctx.runMutation(internal.mcp.insert, {
      workspaceId: args.workspaceId,
      name,
      url: checkServerUrl(args.url, true).toString(),
      serverName: serverName ?? undefined,
      authHeader: authValue ? headerName : undefined,
      secret: sealed ? { ciphertext: sealed.ciphertext, iv: sealed.iv, last4: authValue!.slice(-4) } : undefined,
      tools: summarize(tools),
    });
    return { ok: true, message: `Connected. The server has ${tools.length} tools.`, serverId };
  },
});

export const insert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    serverName: v.optional(v.string()),
    authHeader: v.optional(v.string()),
    secret: v.optional(v.object({ ciphertext: v.string(), iv: v.string(), last4: v.string() })),
    tools: v.array(toolValidator),
  },
  handler: async (ctx, args) => {
    const sourceId = await ctx.db.insert("sources", {
      workspaceId: args.workspaceId,
      type: "mcp",
      config: { name: args.name },
      enabled: true,
    });
    const serverId = await ctx.db.insert("mcpServers", {
      workspaceId: args.workspaceId,
      name: args.name,
      url: args.url,
      serverName: args.serverName,
      authHeader: args.authHeader,
      enabled: true,
      toolAllowlist: [],
      tools: args.tools,
      pulls: [],
      sourceId,
    });
    if (args.secret) {
      const secretId = await ctx.db.insert("secrets", {
        workspaceId: args.workspaceId,
        kind: "mcp",
        label: serverId,
        ...args.secret,
        testedAt: Date.now(),
        testOk: true,
      });
      await ctx.db.patch(serverId, { secretId });
    }
    await ctx.db.patch(sourceId, { config: { name: args.name, mcpServerId: serverId } });
    return serverId;
  },
});

export const serverForSync = internalQuery({
  args: { serverId: v.id("mcpServers") },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server) return null;
    const secret = server.secretId ? await ctx.db.get(server.secretId) : null;
    return { server, secret: secret ? { ciphertext: secret.ciphertext, iv: secret.iv } : null };
  },
});

async function connectTo(server: Doc<"mcpServers">, secret: { ciphertext: string; iv: string } | null) {
  const header = secret && server.authHeader ? { name: server.authHeader, value: await decrypt(secret.ciphertext, secret.iv) } : undefined;
  const client = clientFor(server.url, header);
  await client.connect();
  return client;
}

export const refreshTools = action({
  args: { serverId: v.id("mcpServers") },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const found = await ctx.runQuery(internal.mcp.serverForSync, args);
    if (!found) return { ok: false, message: "This server no longer exists." };
    await ctx.runQuery(internal.access.check, { workspaceId: found.server.workspaceId, role: "owner" });
    try {
      const client = await connectTo(found.server, found.secret);
      const tools = await client.listTools();
      await ctx.runMutation(internal.mcp.saveSync, { serverId: args.serverId, tools: summarize(tools) });
      return { ok: true, message: `Connected. The server has ${tools.length} tools.` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not connect to the server.";
      await ctx.runMutation(internal.mcp.saveSync, { serverId: args.serverId, error: message });
      return { ok: false, message };
    }
  },
});

export const saveSync = internalMutation({
  args: { serverId: v.id("mcpServers"), tools: v.optional(v.array(toolValidator)), error: v.optional(v.string()), synced: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server) return;
    await ctx.db.patch(server._id, {
      ...(args.tools ? { tools: args.tools } : {}),
      ...(args.synced ? { lastSyncedAt: Date.now() } : {}),
      lastError: args.error,
    });
  },
});

/** Chooses which read tools run on each scan, and the fixed input each one gets. */
export const setPulls = mutation({
  args: { serverId: v.id("mcpServers"), pulls: v.array(v.object({ tool: v.string(), args: v.string() })) },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server) throw new ConvexError("This server no longer exists.");
    await requireOwner(ctx, server.workspaceId);
    if (args.pulls.length > MAX_PULLS) throw new ConvexError(`Choose up to ${MAX_PULLS} tools.`);
    const tools = new Map((server.tools ?? []).map((tool) => [tool.name, tool]));
    for (const pull of args.pulls) {
      const tool = tools.get(pull.tool);
      if (!tool) throw new ConvexError(`The server has no tool named ${pull.tool}.`);
      if (!tool.readOnly) {
        throw new ConvexError(`${pull.tool} may change data, so opentopost will not run it. Choose a tool that only reads.`);
      }
      if (pull.args.length > 2000) throw new ConvexError("Keep each tool input under 2,000 characters.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(pull.args || "{}");
      } catch {
        throw new ConvexError(`The input for ${pull.tool} is not valid JSON.`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ConvexError(`The input for ${pull.tool} must be a JSON object, such as {}.`);
      }
    }
    await ctx.db.patch(server._id, {
      pulls: args.pulls.map((pull) => ({ tool: pull.tool, args: pull.args.trim() || "{}" })),
      toolAllowlist: [...new Set(args.pulls.map((pull) => pull.tool))],
    });
  },
});

export const setEnabled = mutation({
  args: { serverId: v.id("mcpServers"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server) return;
    await requireOwner(ctx, server.workspaceId);
    await ctx.db.patch(server._id, { enabled: args.enabled });
    if (server.sourceId) await ctx.db.patch(server.sourceId, { enabled: args.enabled });
  },
});

export const remove = mutation({
  args: { serverId: v.id("mcpServers") },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server) return;
    await requireOwner(ctx, server.workspaceId);
    if (server.secretId) await ctx.db.delete(server.secretId);
    if (server.sourceId) {
      const items = await ctx.db
        .query("sourceItems")
        .withIndex("by_source_created", (q) => q.eq("sourceId", server.sourceId!))
        .take(1000);
      for (const item of items) await ctx.db.delete(item._id);
      await ctx.db.delete(server.sourceId);
    }
    await ctx.db.delete(server._id);
  },
});

export const syncTargets = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const servers = await ctx.db
      .query("mcpServers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return servers.filter((server) => server.enabled && server.sourceId && (server.pulls ?? []).length > 0).map((server) => server._id);
  },
});

async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Splits a tool result into items: one per element when the tool returns a JSON list. */
function splitResult(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? Object.values(parsed as Record<string, unknown>).find(Array.isArray)
        : null;
    if (Array.isArray(list) && list.length) {
      return list.slice(0, MAX_ITEMS_PER_PULL).map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry, null, 1)));
    }
  } catch {
    // Not JSON. Keep the text as one item.
  }
  return [text];
}

/** Runs each chosen read tool and saves what it returns as source material. The model never calls tools. */
export const ingest = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    const serverIds = await ctx.runQuery(internal.mcp.syncTargets, args);
    for (const serverId of serverIds) {
      const found = await ctx.runQuery(internal.mcp.serverForSync, { serverId });
      if (!found?.server.sourceId) continue;
      const { server } = found;
      const sourceId = found.server.sourceId;
      try {
        const client = await connectTo(server, found.secret);
        const allowed = new Set(server.toolAllowlist);
        const items: { externalId: string; title: string; text: string; author: string; createdAt: number }[] = [];
        for (const pull of server.pulls ?? []) {
          if (!allowed.has(pull.tool)) continue;
          const text = await client.callTool(pull.tool, JSON.parse(pull.args || "{}") as Record<string, unknown>);
          for (const part of splitResult(text)) {
            const clean = part.trim().slice(0, MAX_ITEM_TEXT);
            if (clean.length < 40) continue;
            items.push({
              externalId: `${pull.tool}:${await digest(clean)}`,
              title: `${server.name}: ${pull.tool}`,
              text: clean,
              author: server.name,
              createdAt: Date.now(),
            });
          }
        }
        if (items.length) {
          await ctx.runMutation(internal.sources.saveItems, { workspaceId: args.workspaceId, sourceId, items });
        }
        await ctx.runMutation(internal.mcp.saveSync, { serverId, synced: true });
      } catch (error) {
        await ctx.runMutation(internal.mcp.saveSync, {
          serverId,
          error: error instanceof Error ? error.message.slice(0, 300) : "The sync failed.",
        });
      }
    }
  },
});
