/** A small client for remote MCP servers over Streamable HTTP. It only lists and calls tools. */

import { isPrivateHost } from "./safeFetch";

const PROTOCOL = "2025-06-18";
const TIMEOUT = 20000;
const MAX_BYTES = 2_000_000;

export type McpTool = {
  name: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
};

type RpcResponse = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { code: number; message: string } };

/** Rejects links that point at private networks, so a server URL cannot reach inside our host. */
export function checkServerUrl(raw: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter the full server URL, starting with https://.");
  }
  if (url.username || url.password) throw new Error("Put credentials in the auth header, not in the URL.");
  if (!allowPrivate) {
    if (url.protocol !== "https:") throw new Error("The server URL must start with https://.");
    if (isPrivateHost(url.hostname)) throw new Error("Private and local addresses are not allowed on the hosted version.");
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The server URL must start with https:// or http://.");
  }
  return url;
}

function parseBody(contentType: string, text: string, id: number): RpcResponse | null {
  if (contentType.includes("text/event-stream")) {
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        const message = JSON.parse(data) as RpcResponse;
        if (message.id === id) return message;
      } catch {
        continue;
      }
    }
    return null;
  }
  const parsed = JSON.parse(text) as RpcResponse | RpcResponse[];
  return Array.isArray(parsed) ? (parsed.find((message) => message.id === id) ?? null) : parsed;
}

export class McpClient {
  private session: string | null = null;
  private next = 1;
  private ready = false;

  constructor(
    private url: URL,
    private headers: Record<string, string> = {},
  ) {}

  private async post(body: unknown, expectReply: boolean, id = 0): Promise<RpcResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(this.ready ? { "MCP-Protocol-Version": PROTOCOL } : {}),
          ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
          ...this.headers,
        },
        body: JSON.stringify(body),
      });
      const session = response.headers.get("mcp-session-id");
      if (session) this.session = session;
      if (response.status === 401 || response.status === 403) throw new Error("The server did not accept the auth header.");
      if (!response.ok && response.status !== 202) throw new Error(`The server returned ${response.status}.`);
      if (!expectReply) return null;
      const text = (await response.text()).slice(0, MAX_BYTES);
      const message = parseBody(response.headers.get("content-type") ?? "", text, id);
      if (!message) throw new Error("The server sent no answer.");
      if (message.error) throw new Error(message.error.message || "The server returned an error.");
      return message;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("The server did not answer in 20 seconds.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.next++;
    const message = await this.post({ jsonrpc: "2.0", id, method, params }, true, id);
    return message!.result as T;
  }

  async connect(): Promise<{ name: string | null }> {
    const result = await this.request<{ serverInfo?: { name?: string } }>("initialize", {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "opentopost", version: "1.0.0" },
    });
    this.ready = true;
    await this.post({ jsonrpc: "2.0", method: "notifications/initialized" }, false);
    return { name: result.serverInfo?.name ?? null };
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await this.request<{ tools: McpTool[]; nextCursor?: string }>("tools/list", cursor ? { cursor } : {});
      tools.push(...result.tools);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request<{ content?: { type: string; text?: string }[]; isError?: boolean; structuredContent?: unknown }>("tools/call", {
      name,
      arguments: args,
    });
    const text = (result.content ?? [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n");
    if (result.isError) throw new Error(text.slice(0, 300) || "The tool returned an error.");
    if (text) return text;
    return result.structuredContent ? JSON.stringify(result.structuredContent) : "";
  }
}

const READ_NAME = /^(get|list|search|read|fetch|query|find|retrieve|describe|show|lookup|view)[_\-A-Z]/i;

/** opentopost only calls tools that read. A tool counts as read-only when the server says so or its name says so. */
export function isReadTool(tool: McpTool): boolean {
  if (tool.annotations?.destructiveHint) return false;
  return tool.annotations?.readOnlyHint === true || READ_NAME.test(tool.name);
}
