/** Read-only fetchers for each connector. Each returns plain-text items for the scan. */

import { checkServerUrl } from "./mcp";
import { safeFetch } from "./safeFetch";

export type Item = { externalId: string; title: string; text: string; author: string; url?: string; createdAt: number };
export type Values = Record<string, string>;

const MAX_TEXT = 8000;
const TIMEOUT = 20000;

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The service did not answer in 20 seconds.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Like request(), for links users type: every redirect is checked against private addresses. */
async function guarded(url: string, init: RequestInit, allowPrivate: boolean): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await safeFetch(url, { ...init, signal: controller.signal }, { allowPrivate });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The service did not answer in 20 seconds.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function json<T>(url: string, init: RequestInit, service: string): Promise<T> {
  const response = await request(url, init);
  if (response.status === 401 || response.status === 403) throw new Error(`${service} did not accept the key. Check it and its access.`);
  if (response.status === 404) throw new Error(`${service} could not find that. Check the link or name.`);
  if (response.status === 429) throw new Error(`${service} rate limited the request. It will try again on the next scan.`);
  if (!response.ok) throw new Error(`${service} returned an error (${response.status}).`);
  return (await response.json()) as T;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

/** Removes customer names, emails, and phone numbers before support text is saved. */
export function anonymise(text: string, names: (string | undefined | null)[]): string {
  let out = text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
  const parts = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const clean = name.trim();
    if (clean.length >= 3) parts.add(clean);
    for (const piece of clean.split(/\s+/)) if (piece.length >= 3) parts.add(piece);
  }
  for (const part of [...parts].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "the customer");
  }
  return out;
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

// ---------- RSS and Atom ----------

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!match) return null;
  return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

export async function testRss(values: Values, allowPrivate: boolean): Promise<string> {
  const items = await fetchRss(values, 0, allowPrivate);
  return `Found ${items.length} ${items.length === 1 ? "entry" : "entries"} in the feed.`;
}

export async function fetchRss(values: Values, since: number, allowPrivate: boolean): Promise<Item[]> {
  const url = checkServerUrl(values.url, allowPrivate).toString();
  const response = await guarded(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } }, allowPrivate);
  if (!response.ok) throw new Error(`The feed returned an error (${response.status}).`);
  const xml = (await response.text()).slice(0, 3_000_000);
  if (!/<(rss|feed|rdf)/i.test(xml)) throw new Error("That link is not an RSS or Atom feed.");
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((match) => match[0]).slice(0, 50);
  const items: Item[] = [];
  for (const block of blocks) {
    const title = htmlToText(tag(block, "title") ?? "Untitled");
    const link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? tag(block, "link") ?? undefined;
    const body = tag(block, "content:encoded") ?? tag(block, "content") ?? tag(block, "description") ?? tag(block, "summary") ?? "";
    const date = tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date");
    const createdAt = date ? Date.parse(date) || Date.now() : Date.now();
    if (createdAt < since) continue;
    const text = htmlToText(body);
    items.push({
      externalId: tag(block, "guid") ?? tag(block, "id") ?? link ?? title,
      title,
      text: `${title}\n\n${text}`.slice(0, MAX_TEXT),
      author: htmlToText(tag(block, "author") ?? tag(block, "dc:creator") ?? "") || "Feed",
      url: link,
      createdAt,
    });
  }
  return items;
}

// ---------- Linear ----------

async function linear<T>(apiKey: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = await json<{ data?: T; errors?: { message: string }[] }>(
    "https://api.linear.app/graphql",
    { method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) },
    "Linear",
  );
  if (body.errors?.length) throw new Error(`Linear: ${body.errors[0].message}`);
  return body.data as T;
}

export async function testLinear(values: Values): Promise<string> {
  const data = await linear<{ organization: { name: string } }>(values.apiKey, "query { organization { name } }");
  return `Connected to ${data.organization.name}.`;
}

export async function fetchLinear(values: Values, since: number): Promise<Item[]> {
  const teams = list(values.teams);
  const filter: Record<string, unknown> = { completedAt: { gte: new Date(since).toISOString() } };
  if (teams.length) filter.team = { key: { in: teams } };
  const data = await linear<{
    issues: {
      nodes: {
        identifier: string;
        title: string;
        description: string | null;
        url: string;
        completedAt: string;
        assignee: { name: string } | null;
        team: { key: string } | null;
        labels: { nodes: { name: string }[] };
      }[];
    };
  }>(
    values.apiKey,
    "query($filter: IssueFilter) { issues(first: 100, filter: $filter, orderBy: updatedAt) { nodes { identifier title description url completedAt assignee { name } team { key } labels { nodes { name } } } } }",
    { filter },
  );
  return data.issues.nodes.map((issue) => ({
    externalId: issue.identifier,
    title: `${issue.identifier}: ${issue.title}`,
    text: [
      `Completed issue ${issue.identifier}: ${issue.title}`,
      issue.labels.nodes.length ? `Labels: ${issue.labels.nodes.map((label) => label.name).join(", ")}` : "",
      (issue.description ?? "").slice(0, 6000),
    ]
      .filter(Boolean)
      .join("\n\n"),
    author: issue.assignee?.name ?? "someone",
    url: issue.url,
    createdAt: Date.parse(issue.completedAt),
  }));
}

// ---------- Jira ----------

function jiraSite(values: Values): string {
  const site = values.site.trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(site)) throw new Error("Use your Jira Cloud link, such as https://yourcompany.atlassian.net.");
  return site;
}

function jiraHeaders(values: Values) {
  return { Authorization: `Basic ${btoa(`${values.email.trim()}:${values.token.trim()}`)}`, Accept: "application/json" };
}

type Adf = { type?: string; text?: string; content?: Adf[] };
function adfText(node: Adf | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(adfText).join(node.type === "doc" ? "\n" : "");
  return ["paragraph", "heading", "listItem", "codeBlock", "blockquote"].includes(node.type ?? "") ? `${inner}\n` : inner;
}

export async function testJira(values: Values): Promise<string> {
  const me = await json<{ displayName: string }>(`${jiraSite(values)}/rest/api/3/myself`, { headers: jiraHeaders(values) }, "Jira");
  return `Connected as ${me.displayName}.`;
}

export async function fetchJira(values: Values, since: number): Promise<Item[]> {
  const site = jiraSite(values);
  const days = Math.max(1, Math.ceil((Date.now() - since) / 86_400_000));
  const projects = list(values.projects).filter((key) => /^[A-Z][A-Z0-9_]+$/i.test(key));
  const jql = [`statusCategory = Done`, `resolved >= -${days}d`, projects.length ? `project in (${projects.join(",")})` : ""]
    .filter(Boolean)
    .join(" AND ");
  const params = new URLSearchParams({
    jql: `${jql} ORDER BY resolved DESC`,
    maxResults: "50",
    fields: "summary,description,resolutiondate,assignee,labels",
  });
  const data = await json<{
    issues: {
      key: string;
      fields: { summary: string; description: Adf | null; resolutiondate: string | null; assignee: { displayName: string } | null; labels: string[] };
    }[];
  }>(`${site}/rest/api/3/search/jql?${params}`, { headers: jiraHeaders(values) }, "Jira");
  return data.issues.map((issue) => ({
    externalId: issue.key,
    title: `${issue.key}: ${issue.fields.summary}`,
    text: [
      `Resolved issue ${issue.key}: ${issue.fields.summary}`,
      issue.fields.labels.length ? `Labels: ${issue.fields.labels.join(", ")}` : "",
      adfText(issue.fields.description).trim().slice(0, 6000),
    ]
      .filter(Boolean)
      .join("\n\n"),
    author: issue.fields.assignee?.displayName ?? "someone",
    url: `${site}/browse/${issue.key}`,
    createdAt: issue.fields.resolutiondate ? Date.parse(issue.fields.resolutiondate) : Date.now(),
  }));
}

// ---------- Notion ----------

const notionHeaders = (values: Values) => ({
  Authorization: `Bearer ${values.token.trim()}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

export async function testNotion(values: Values): Promise<string> {
  const me = await json<{ name?: string }>("https://api.notion.com/v1/users/me", { headers: notionHeaders(values) }, "Notion");
  const pages = await json<{ results: unknown[] }>(
    "https://api.notion.com/v1/search",
    { method: "POST", headers: notionHeaders(values), body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 5 }) },
    "Notion",
  );
  if (pages.results.length === 0) return `Connected as ${me.name ?? "the integration"}, but no pages are shared with it yet.`;
  return `Connected as ${me.name ?? "the integration"}.`;
}

type NotionRich = { plain_text: string }[];
type NotionBlock = { type: string; [key: string]: unknown };

export async function fetchNotion(values: Values, since: number): Promise<Item[]> {
  const headers = notionHeaders(values);
  const search = await json<{
    results: { id: string; url: string; last_edited_time: string; properties: Record<string, { type: string; title?: NotionRich }> }[];
  }>(
    "https://api.notion.com/v1/search",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 25,
      }),
    },
    "Notion",
  );
  const items: Item[] = [];
  for (const page of search.results) {
    const edited = Date.parse(page.last_edited_time);
    if (edited < since) break;
    const titleProp = Object.values(page.properties).find((prop) => prop.type === "title");
    const title = titleProp?.title?.map((part) => part.plain_text).join("") || "Untitled page";
    const blocks = await json<{ results: NotionBlock[] }>(
      `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`,
      { headers },
      "Notion",
    );
    const lines: string[] = [];
    for (const block of blocks.results) {
      const content = block[block.type] as { rich_text?: NotionRich } | undefined;
      const text = content?.rich_text?.map((part) => part.plain_text).join("") ?? "";
      if (!text) continue;
      lines.push(block.type.startsWith("heading") ? `\n${text}` : block.type.includes("list_item") || block.type === "to_do" ? `- ${text}` : text);
    }
    const body = lines.join("\n").trim();
    if (!body) continue;
    items.push({ externalId: page.id, title, text: `${title}\n\n${body}`.slice(0, MAX_TEXT), author: "Notion", url: page.url, createdAt: edited });
  }
  return items;
}

// ---------- Google Drive (service account token from googleNode) ----------

export function folderId(link: string): string {
  const trimmed = link.trim();
  const match = trimmed.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  const id = match?.[1] ?? (/^[A-Za-z0-9_-]{10,}$/.test(trimmed) ? trimmed : null);
  if (!id) throw new Error("Paste the link of a Google Drive folder.");
  return id;
}

const DRIVE = "https://www.googleapis.com/drive/v3";

export async function testDrive(values: Values, token: string): Promise<string> {
  const folder = await json<{ name: string }>(
    `${DRIVE}/files/${folderId(values.folder)}?fields=name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
    "Google Drive",
  );
  return `Connected to the folder ${folder.name}.`;
}

export async function fetchDrive(values: Values, since: number, token: string): Promise<Item[]> {
  const id = folderId(values.folder);
  const q = `'${id}' in parents and trashed = false and modifiedTime > '${new Date(since).toISOString()}'`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,lastModifyingUser(displayName))",
    pageSize: "25",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const headers = { Authorization: `Bearer ${token}` };
  const data = await json<{
    files: { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink?: string; lastModifyingUser?: { displayName?: string } }[];
  }>(`${DRIVE}/files?${params}`, { headers }, "Google Drive");
  const items: Item[] = [];
  for (const file of data.files) {
    let url: string | null = null;
    if (file.mimeType === "application/vnd.google-apps.document") url = `${DRIVE}/files/${file.id}/export?mimeType=text/plain`;
    else if (file.mimeType === "text/plain" || file.mimeType === "text/markdown") url = `${DRIVE}/files/${file.id}?alt=media`;
    if (!url) continue;
    const response = await request(url, { headers });
    if (!response.ok) continue;
    const text = (await response.text()).trim();
    if (text.length < 40) continue;
    items.push({
      externalId: `${file.id}:${file.modifiedTime}`,
      title: file.name,
      text: `${file.name}\n\n${text}`.slice(0, MAX_TEXT),
      author: file.lastModifyingUser?.displayName ?? "Google Docs",
      url: file.webViewLink,
      createdAt: Date.parse(file.modifiedTime),
    });
  }
  return items;
}

// ---------- Intercom ----------

function intercomBase(values: Values) {
  return values.region === "eu" ? "https://api.eu.intercom.io" : values.region === "au" ? "https://api.au.intercom.io" : "https://api.intercom.io";
}

const intercomHeaders = (values: Values) => ({
  Authorization: `Bearer ${values.token.trim()}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  "Intercom-Version": "2.11",
});

export async function testIntercom(values: Values): Promise<string> {
  const me = await json<{ app?: { name?: string } }>(`${intercomBase(values)}/me`, { headers: intercomHeaders(values) }, "Intercom");
  return `Connected to ${me.app?.name ?? "Intercom"}.`;
}

type IntercomAuthor = { type?: string; name?: string | null; email?: string | null };

export async function fetchIntercom(values: Values, since: number): Promise<Item[]> {
  const base = intercomBase(values);
  const headers = intercomHeaders(values);
  const search = await json<{ conversations: { id: string; updated_at: number }[] }>(
    `${base}/conversations/search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          operator: "AND",
          value: [
            { field: "updated_at", operator: ">", value: Math.floor(since / 1000) },
            { field: "state", operator: "=", value: "closed" },
          ],
        },
        pagination: { per_page: 20 },
      }),
    },
    "Intercom",
  );
  const items: Item[] = [];
  for (const row of search.conversations) {
    const conversation = await json<{
      id: string;
      source?: { body?: string; author?: IntercomAuthor };
      conversation_parts?: { conversation_parts: { body?: string | null; author?: IntercomAuthor }[] };
    }>(`${base}/conversations/${row.id}`, { headers }, "Intercom");
    const customers: string[] = [];
    const lines: string[] = [];
    const add = (body: string | null | undefined, author?: IntercomAuthor) => {
      if (!body) return;
      const isCustomer = author?.type === "user" || author?.type === "lead" || author?.type === "contact";
      if (isCustomer && author?.name) customers.push(author.name);
      lines.push(`${isCustomer ? "Customer" : "Support"}: ${htmlToText(body)}`);
    };
    add(conversation.source?.body, conversation.source?.author);
    for (const part of conversation.conversation_parts?.conversation_parts ?? []) add(part.body, part.author);
    const text = anonymise(lines.join("\n\n"), customers).trim();
    if (text.length < 80) continue;
    items.push({
      externalId: `conversation:${row.id}`,
      title: "Support conversation",
      text: text.slice(0, MAX_TEXT),
      author: "Support",
      createdAt: row.updated_at * 1000,
    });
  }
  return items;
}

// ---------- Zendesk ----------

function zendeskBase(values: Values) {
  const sub = values.subdomain
    .trim()
    .toLowerCase()
    .replace(/\.zendesk\.com.*$/, "")
    .replace(/^https?:\/\//, "");
  if (!/^[a-z0-9-]+$/.test(sub)) throw new Error("Use only your Zendesk subdomain, such as yourcompany.");
  return `https://${sub}.zendesk.com`;
}

const zendeskHeaders = (values: Values) => ({
  Authorization: `Basic ${btoa(`${values.email.trim()}/token:${values.token.trim()}`)}`,
  Accept: "application/json",
});

export async function testZendesk(values: Values): Promise<string> {
  const me = await json<{ user: { name: string; role: string } }>(
    `${zendeskBase(values)}/api/v2/users/me.json`,
    { headers: zendeskHeaders(values) },
    "Zendesk",
  );
  if (me.user.role === "end-user") throw new Error("Zendesk did not accept the token. Check the email and token.");
  return `Connected as ${me.user.name}.`;
}

export async function fetchZendesk(values: Values, since: number): Promise<Item[]> {
  const base = zendeskBase(values);
  const headers = zendeskHeaders(values);
  const day = new Date(since).toISOString().slice(0, 10);
  const search = await json<{ results: { id: number; subject?: string; updated_at: string }[] }>(
    `${base}/api/v2/search.json?${new URLSearchParams({ query: `type:ticket status:solved updated>${day}`, sort_by: "updated_at", sort_order: "desc", per_page: "20" })}`,
    { headers },
    "Zendesk",
  );
  const items: Item[] = [];
  for (const ticket of search.results) {
    const data = await json<{
      comments: { author_id: number; plain_body?: string; body?: string; public: boolean }[];
      users?: { id: number; name: string; role: string }[];
    }>(`${base}/api/v2/tickets/${ticket.id}/comments.json?include=users`, { headers }, "Zendesk");
    const users = new Map((data.users ?? []).map((user) => [user.id, user]));
    const customers = (data.users ?? []).filter((user) => user.role === "end-user").map((user) => user.name);
    const lines = data.comments
      .filter((comment) => comment.public)
      .map((comment) => `${users.get(comment.author_id)?.role === "end-user" ? "Customer" : "Support"}: ${comment.plain_body ?? comment.body ?? ""}`);
    const text = anonymise([ticket.subject ? `Subject: ${ticket.subject}` : "", ...lines].filter(Boolean).join("\n\n"), customers).trim();
    if (text.length < 80) continue;
    items.push({
      externalId: `ticket:${ticket.id}`,
      title: "Support ticket",
      text: text.slice(0, MAX_TEXT),
      author: "Support",
      createdAt: Date.parse(ticket.updated_at),
    });
  }
  return items;
}
