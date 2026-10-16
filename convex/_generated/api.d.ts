/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as account from "../account.js";
import type * as agent from "../agent.js";
import type * as agentHttp from "../agentHttp.js";
import type * as analytics from "../analytics.js";
import type * as apiKeys from "../apiKeys.js";
import type * as audits from "../audits.js";
import type * as autopilot from "../autopilot.js";
import type * as billing from "../billing.js";
import type * as connectors from "../connectors.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as drafts from "../drafts.js";
import type * as github from "../github.js";
import type * as githubNode from "../githubNode.js";
import type * as googleNode from "../googleNode.js";
import type * as hosted from "../hosted.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as insights from "../insights.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_claims from "../lib/claims.js";
import type * as lib_connectorTypes from "../lib/connectorTypes.js";
import type * as lib_connectors from "../lib/connectors.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_dedupe from "../lib/dedupe.js";
import type * as lib_editDistance from "../lib/editDistance.js";
import type * as lib_firstScan from "../lib/firstScan.js";
import type * as lib_kinde from "../lib/kinde.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_mcp from "../lib/mcp.js";
import type * as lib_model from "../lib/model.js";
import type * as lib_ops from "../lib/ops.js";
import type * as lib_personal from "../lib/personal.js";
import type * as lib_plan from "../lib/plan.js";
import type * as lib_planLimits from "../lib/planLimits.js";
import type * as lib_providers from "../lib/providers.js";
import type * as lib_safeFetch from "../lib/safeFetch.js";
import type * as lib_style from "../lib/style.js";
import type * as lib_tools from "../lib/tools.js";
import type * as lib_week from "../lib/week.js";
import type * as lib_xConversions from "../lib/xConversions.js";
import type * as linkedin from "../linkedin.js";
import type * as links from "../links.js";
import type * as mcp from "../mcp.js";
import type * as media from "../media.js";
import type * as members from "../members.js";
import type * as modelConfig from "../modelConfig.js";
import type * as moments from "../moments.js";
import type * as oauth from "../oauth.js";
import type * as personal from "../personal.js";
import type * as recaps from "../recaps.js";
import type * as rules from "../rules.js";
import type * as schedule from "../schedule.js";
import type * as secrets from "../secrets.js";
import type * as slack from "../slack.js";
import type * as sources from "../sources.js";
import type * as voice from "../voice.js";
import type * as webhooks from "../webhooks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  account: typeof account;
  agent: typeof agent;
  agentHttp: typeof agentHttp;
  analytics: typeof analytics;
  apiKeys: typeof apiKeys;
  audits: typeof audits;
  autopilot: typeof autopilot;
  billing: typeof billing;
  connectors: typeof connectors;
  crm: typeof crm;
  crons: typeof crons;
  demo: typeof demo;
  drafts: typeof drafts;
  github: typeof github;
  githubNode: typeof githubNode;
  googleNode: typeof googleNode;
  hosted: typeof hosted;
  http: typeof http;
  ideas: typeof ideas;
  insights: typeof insights;
  "lib/ai": typeof lib_ai;
  "lib/auth": typeof lib_auth;
  "lib/claims": typeof lib_claims;
  "lib/connectorTypes": typeof lib_connectorTypes;
  "lib/connectors": typeof lib_connectors;
  "lib/crypto": typeof lib_crypto;
  "lib/dedupe": typeof lib_dedupe;
  "lib/editDistance": typeof lib_editDistance;
  "lib/firstScan": typeof lib_firstScan;
  "lib/kinde": typeof lib_kinde;
  "lib/limits": typeof lib_limits;
  "lib/mcp": typeof lib_mcp;
  "lib/model": typeof lib_model;
  "lib/ops": typeof lib_ops;
  "lib/personal": typeof lib_personal;
  "lib/plan": typeof lib_plan;
  "lib/planLimits": typeof lib_planLimits;
  "lib/providers": typeof lib_providers;
  "lib/safeFetch": typeof lib_safeFetch;
  "lib/style": typeof lib_style;
  "lib/tools": typeof lib_tools;
  "lib/week": typeof lib_week;
  "lib/xConversions": typeof lib_xConversions;
  linkedin: typeof linkedin;
  links: typeof links;
  mcp: typeof mcp;
  media: typeof media;
  members: typeof members;
  modelConfig: typeof modelConfig;
  moments: typeof moments;
  oauth: typeof oauth;
  personal: typeof personal;
  recaps: typeof recaps;
  rules: typeof rules;
  schedule: typeof schedule;
  secrets: typeof secrets;
  slack: typeof slack;
  sources: typeof sources;
  voice: typeof voice;
  webhooks: typeof webhooks;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  convexKindeBilling: import("convex-kinde-billing/_generated/component.js").ComponentApi<"convexKindeBilling">;
};
