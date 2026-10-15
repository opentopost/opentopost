import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { hashKey } from "./apiKeys";
import { TOOLS, toolByName } from "./lib/tools";

/*
 * The agent surface:
 *   GET  /api/v1            lists the tools
 *   POST /api/v1/<tool>     runs one tool with a JSON body
 *   POST /mcp               MCP (Streamable HTTP, JSON responses) with the same tools
 * Every request sends `Authorization: Bearer otp_...`.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...headers } });

type Caller = { memberId: string; keyId: string; keyName: string; scopes: string[] };

async function authenticate(ctx: ActionCtx, request: Request): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  if (!key.startsWith("otp_")) return null;
  const found = await ctx.runQuery(internal.apiKeys.resolve, { hash: await hashKey(key) });
  if (!found) return null;
  await ctx.runMutation(internal.apiKeys.touch, { keyId: found.key._id });
  return { memberId: found.member._id, keyId: found.key._id, keyName: found.key.name, scopes: found.key.scopes };
}

const unauthorized = () =>
  json({ error: "Send a valid opentopost API key as `Authorization: Bearer otp_...`. Create one in Settings > API." }, 401, {
    "WWW-Authenticate": 'Bearer realm="opentopost"',
  });

function errorText(error: unknown) {
  if (error instanceof ConvexError) return String(error.data);
  return "The request failed. Try again.";
}

async function runTool(ctx: ActionCtx, caller: Caller, name: string, input: unknown) {
  return ctx.runMutation(internal.agent.run, {
    memberId: caller.memberId as never,
    keyName: caller.keyName,
    scopes: caller.scopes,
    tool: name,
    input: input ?? {},
  });
}

export const options = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

export const discovery = httpAction(async () =>
  json({
    name: "opentopost",
    docs: "https://opentopost.com/docs/agents",
    mcp: "/mcp",
    tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description, scope: tool.scope, input: tool.input, endpoint: `/api/v1/${tool.name}` })),
  }),
);

export const rest = httpAction(async (ctx, request) => {
  const name = new URL(request.url).pathname.replace(/^\/api\/v1\/?/, "").replace(/\/$/, "");
  if (!toolByName.has(name)) return json({ error: `Unknown tool "${name}". GET /api/v1 lists the tools.` }, 404);
  const caller = await authenticate(ctx, request);
  if (!caller) return unauthorized();
  let input: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      input = JSON.parse(text);
    } catch {
      return json({ error: "The body must be JSON." }, 400);
    }
  }
  try {
    return json({ data: await runTool(ctx, caller, name, input) });
  } catch (error) {
    return json({ error: errorText(error) }, error instanceof ConvexError ? 400 : 500);
  }
});

/* ------------------------------------------------------------------------ */
/* MCP                                                                      */

const PROTOCOL = "2025-06-18";
type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleRpc(ctx: ActionCtx, caller: Caller, message: RpcRequest) {
  switch (message.method) {
    case "initialize":
      return rpcResult(message.id, {
        protocolVersion: typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "opentopost", title: "opentopost", version: "1.0.0" },
        instructions:
          "opentopost turns a team's real work into posts in each person's voice. Start with list_ideas or list_moments, claim one, poll get_draft until status is ready, then revise, request review, or schedule. Never invent facts: drafts only use sourced facts.",
      });
    case "ping":
      return rpcResult(message.id, {});
    case "tools/list":
      return rpcResult(message.id, {
        tools: TOOLS.filter((tool) => caller.scopes.includes(tool.scope)).map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.input,
          annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: tool.scope === "publish" },
        })),
      });
    case "tools/call": {
      const name = String(message.params?.name ?? "");
      if (!toolByName.has(name)) return rpcError(message.id, -32602, `Unknown tool "${name}".`);
      try {
        const data = await runTool(ctx, caller, name, message.params?.arguments ?? {});
        return rpcResult(message.id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { data } });
      } catch (error) {
        return rpcResult(message.id, { content: [{ type: "text", text: errorText(error) }], isError: true });
      }
    }
    default:
      return rpcError(message.id, -32601, `Method "${message.method}" is not supported.`);
  }
}

export const mcp = httpAction(async (ctx, request) => {
  const caller = await authenticate(ctx, request);
  if (!caller) return unauthorized();
  let body: RpcRequest | RpcRequest[];
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const message of messages) {
    // Notifications (no id) get no reply.
    if (message.id === undefined || message.id === null) continue;
    replies.push(await handleRpc(ctx, caller, message));
  }
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? replies : replies[0], 200, { "Mcp-Protocol-Version": PROTOCOL });
});

export const mcpGet = httpAction(async () => new Response("This MCP server answers POST requests only.", { status: 405, headers: { Allow: "POST", ...CORS } }));
