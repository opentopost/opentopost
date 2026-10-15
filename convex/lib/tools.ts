/*
 * The tools an agent can use, shared by the REST API (/api/v1/<tool>) and the
 * MCP server (/mcp). Each tool names the scope it needs and a JSON Schema for
 * its input. agent.ts runs them.
 */

export type ToolScope = "read" | "draft" | "publish" | "admin";

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  readOnly: boolean;
  input: JsonSchema;
};

const channel = {
  type: "string",
  enum: ["linkedin", "x", "changelog", "investor_update", "newsletter"],
  description: "Where the post will be published. Defaults to linkedin.",
};
const id = (what: string) => ({ type: "string", description: `The ${what} id.` });
const none: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

export const TOOLS: ToolDef[] = [
  {
    name: "whoami",
    title: "Who am I",
    description: "Returns the workspace, the member this key acts as, their role, and the key's scopes.",
    scope: "read",
    readOnly: true,
    input: none,
  },
  {
    name: "list_ideas",
    title: "List post ideas",
    description: "Lists this week's and recent post ideas, highest score first, with who each idea suits and its source facts.",
    scope: "read",
    readOnly: true,
    input: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["new", "claimed", "drafted", "posted"], description: "Only ideas with this status." },
        limit: { type: "number", description: "At most this many ideas (1 to 50). Defaults to 20." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_moments",
    title: "List moments",
    description: "Lists true things the team did (launches, fixes, results, lessons), each with the quotes that prove it.",
    scope: "read",
    readOnly: true,
    input: {
      type: "object",
      properties: { limit: { type: "number", description: "At most this many moments (1 to 50). Defaults to 20." } },
      additionalProperties: false,
    },
  },
  {
    name: "list_drafts",
    title: "List my drafts",
    description: "Lists drafts written for the member this key acts as, newest first, with status and schedule.",
    scope: "read",
    readOnly: true,
    input: {
      type: "object",
      properties: { limit: { type: "number", description: "At most this many drafts (1 to 50). Defaults to 20." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_draft",
    title: "Get a draft",
    description: "Returns one draft: hooks, body, every claim with its supporting facts, review state, and schedule.",
    scope: "read",
    readOnly: true,
    input: { type: "object", properties: { draftId: id("draft") }, required: ["draftId"], additionalProperties: false },
  },
  {
    name: "get_recap",
    title: "Get the weekly recap",
    description: "Returns the latest weekly recap: posts, link clicks, conversions, top posts, and who posted.",
    scope: "read",
    readOnly: true,
    input: none,
  },
  {
    name: "claim_idea",
    title: "Claim an idea",
    description: "Claims an idea and starts writing a draft in the member's voice. Drafts take about 20 seconds; poll get_draft until status is ready.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: { ideaId: id("idea"), channel, company: { type: "boolean", description: "Write for the company page. Owners and admins only." } },
      required: ["ideaId"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_from_moment",
    title: "Draft from a moment",
    description: "Starts a draft from one moment, for any channel. Poll get_draft until status is ready.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: { momentId: id("moment"), channel, company: { type: "boolean" } },
      required: ["momentId"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_from_brief",
    title: "Draft from a brief",
    description: "Starts a draft from your own description of what happened. Include any numbers or names to use; nothing else is invented.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: { brief: { type: "string", description: "What happened, in 15 to 6,000 characters." }, channel, company: { type: "boolean" } },
      required: ["brief"],
      additionalProperties: false,
    },
  },
  {
    name: "revise_draft",
    title: "Ask for a change",
    description: "Rewrites a draft with one change, keeping the voice and the facts. Poll get_draft until status is ready.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: { draftId: id("draft"), instruction: { type: "string", description: "The change, for example: shorter, and lead with the result." } },
      required: ["draftId", "instruction"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_draft",
    title: "Edit a draft",
    description: "Replaces the hook, the body, or both with your own text.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: { draftId: id("draft"), hook: { type: "string" }, body: { type: "string" } },
      required: ["draftId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_voice_sample",
    title: "Add a voice sample",
    description: "Adds writing by the member (a post, a note, a transcript) so drafts sound more like them.",
    scope: "draft",
    readOnly: false,
    input: {
      type: "object",
      properties: {
        text: { type: "string", description: "At least a few sentences of their own words." },
        kind: { type: "string", enum: ["post", "tweet", "article", "note", "spoken", "other"] },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "request_review",
    title: "Ask for review",
    description: "Sends a ready draft to the workspace's reviewers.",
    scope: "draft",
    readOnly: false,
    input: { type: "object", properties: { draftId: id("draft") }, required: ["draftId"], additionalProperties: false },
  },
  {
    name: "review_draft",
    title: "Approve or return a draft",
    description: "Approves a draft waiting for review, or returns it with a comment. Needs a reviewer, admin, or owner key.",
    scope: "publish",
    readOnly: false,
    input: {
      type: "object",
      properties: { draftId: id("draft"), approve: { type: "boolean" }, comment: { type: "string" } },
      required: ["draftId", "approve"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_draft",
    title: "Schedule a draft",
    description:
      "Schedules a ready draft. Without a time it uses the workspace's next posting slot. LinkedIn posts publish automatically when the author connected LinkedIn; otherwise the author gets a reminder.",
    scope: "publish",
    readOnly: false,
    input: {
      type: "object",
      properties: {
        draftId: id("draft"),
        at: { type: "string", description: "ISO 8601 date and time. Optional." },
        mode: { type: "string", enum: ["publish", "remind"] },
      },
      required: ["draftId"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_schedule",
    title: "Cancel a schedule",
    description: "Removes a draft from the calendar.",
    scope: "publish",
    readOnly: false,
    input: { type: "object", properties: { draftId: id("draft") }, required: ["draftId"], additionalProperties: false },
  },
  {
    name: "mark_posted",
    title: "Mark as posted",
    description: "Records that a draft was posted, with the link to the live post, so clicks and signups count toward it.",
    scope: "publish",
    readOnly: false,
    input: {
      type: "object",
      properties: { draftId: id("draft"), url: { type: "string", description: "The link to the live post." } },
      required: ["draftId", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "start_scan",
    title: "Find new ideas",
    description: "Scans the connected sources for new moments and ideas. Takes one to three minutes.",
    scope: "admin",
    readOnly: false,
    input: none,
  },
];

export const toolByName = new Map(TOOLS.map((tool) => [tool.name, tool]));
