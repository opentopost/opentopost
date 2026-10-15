import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";
import { entitlementsFor } from "./lib/plan";
import { randomState } from "./oauth";
import { countedSources, sourceLimitMessage } from "./sources";

const LOOKBACK = 14 * 24 * 60 * 60 * 1000;
const MAX_REPOS = 20;
const API = "https://api.github.com";

type Repo = { id: number; fullName: string; private: boolean };
type GitHubConfig = { installationId: number; account: string; accountType: string; repos: Repo[] };

const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const configured = () =>
  Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_SLUG &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_CLIENT_SECRET,
  );

async function github<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "opentopost",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function githubSource(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return sources.find((source) => source.type === "github") ?? null;
}

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const source = await githubSource(ctx, args.workspaceId);
    const config = source?.config as GitHubConfig | undefined;
    return {
      available: configured(),
      connected: Boolean(source),
      account: config?.account ?? null,
      repos: config?.repos ?? [],
      lastScannedAt: source?.lastScannedAt ?? null,
      manageUrl:
        config && process.env.GITHUB_APP_SLUG
          ? config.accountType === "Organization"
            ? `https://github.com/organizations/${config.account}/settings/installations/${config.installationId}`
            : `https://github.com/settings/installations/${config.installationId}`
          : null,
    };
  },
});

export const checkCanConnect = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx, args.workspaceId);
    if (!(await githubSource(ctx, args.workspaceId))) {
      const { limits, plan } = await entitlementsFor(ctx, args.workspaceId);
      if ((await countedSources(ctx, args.workspaceId)) >= limits.sources) {
        throw new ConvexError(sourceLimitMessage(plan, limits.sources));
      }
    }
    return owner._id;
  },
});

/** Sends the owner to GitHub to install the app on the repositories they choose. */
export const startInstall = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<string> => {
    if (!configured()) throw new ConvexError("GitHub is not set up on this deployment.");
    const memberId = await ctx.runQuery(internal.github.checkCanConnect, args);
    const state = randomState();
    await ctx.runMutation(internal.oauth.saveState, { provider: "github", state, workspaceId: args.workspaceId, memberId });
    return `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new?state=${state}`;
  },
});

/**
 * GitHub sends the browser back with an installation id and an OAuth code. The code proves the
 * person can see that installation, so nobody can attach another company's repositories by
 * guessing an installation id.
 */
export const completeInstall = internalAction({
  args: { installationId: v.optional(v.string()), code: v.optional(v.string()), state: v.optional(v.string()), setupAction: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const back = (result: string) => `${siteUrl()}/sources?github=${result}`;
    if (args.setupAction === "request") return back("requested");
    if (!args.state) return back("expired");
    const target = await ctx.runMutation(internal.oauth.consumeState, { provider: "github", state: args.state });
    if (!target) return back("expired");
    if (!args.code || !args.installationId) return back("authorize");

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        code: args.code,
      }),
    });
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) return back("error");

    const installationId = Number(args.installationId);
    const mine = await github<{ installations: { id: number; account: { login: string; type: string } }[] }>(
      "/user/installations?per_page=100",
      tokenBody.access_token,
    ).catch(() => null);
    const installation = mine?.installations.find((row) => row.id === installationId);
    if (!installation) return back("error");

    await ctx.runMutation(internal.github.saveInstallation, {
      workspaceId: target.workspaceId,
      installationId,
      account: installation.account.login,
      accountType: installation.account.type,
    });
    return back("connected");
  },
});

export const saveInstallation = internalMutation({
  args: { workspaceId: v.id("workspaces"), installationId: v.number(), account: v.string(), accountType: v.string() },
  handler: async (ctx, args) => {
    const source = await githubSource(ctx, args.workspaceId);
    const previous = source?.config as GitHubConfig | undefined;
    const config: GitHubConfig = {
      installationId: args.installationId,
      account: args.account,
      accountType: args.accountType,
      repos: previous?.installationId === args.installationId ? previous.repos : [],
    };
    if (source) await ctx.db.patch(source._id, { config, enabled: true });
    else await ctx.db.insert("sources", { workspaceId: args.workspaceId, type: "github", config, enabled: true });
  },
});

export const connection = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const source = await githubSource(ctx, args.workspaceId);
    if (!source || !source.enabled) return null;
    return { sourceId: source._id, config: source.config as GitHubConfig, lastScannedAt: source.lastScannedAt ?? null };
  },
});

export const listRepos = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<Repo[]> => {
    await ctx.runQuery(internal.access.check, { workspaceId: args.workspaceId, role: "owner" });
    const conn = await ctx.runQuery(internal.github.connection, args);
    if (!conn) throw new ConvexError("Connect GitHub first.");
    const token = await ctx.runAction(internal.githubNode.installationToken, { installationId: conn.config.installationId });
    const repos: Repo[] = [];
    for (let page = 1; page <= 5; page++) {
      const body = await github<{ repositories: { id: number; full_name: string; private: boolean; archived: boolean }[] }>(
        `/installation/repositories?per_page=100&page=${page}`,
        token,
      );
      repos.push(
        ...body.repositories.filter((repo) => !repo.archived).map((repo) => ({ id: repo.id, fullName: repo.full_name, private: repo.private })),
      );
      if (body.repositories.length < 100) break;
    }
    return repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const setRepos = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    repos: v.array(v.object({ id: v.number(), fullName: v.string(), private: v.boolean() })),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    if (args.repos.length > MAX_REPOS) throw new ConvexError(`Choose up to ${MAX_REPOS} repositories.`);
    const source = await githubSource(ctx, args.workspaceId);
    if (!source) throw new ConvexError("Connect GitHub first.");
    await ctx.db.patch(source._id, { config: { ...(source.config as GitHubConfig), repos: args.repos } });
  },
});

export const disconnect = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const source = await githubSource(ctx, args.workspaceId);
    if (source) await ctx.db.delete(source._id);
  },
});

type PullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  user: { login: string } | null;
  labels: { name: string }[];
};

type Release = {
  id: number;
  name: string | null;
  tag_name: string;
  body: string | null;
  html_url: string;
  draft: boolean;
  published_at: string | null;
  author: { login: string } | null;
};

/** Reads merged pull requests and releases from the chosen repositories. */
export const ingest = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    if (!configured()) return;
    const conn = await ctx.runQuery(internal.github.connection, args);
    if (!conn || conn.config.repos.length === 0) return;
    let token: string;
    try {
      token = await ctx.runAction(internal.githubNode.installationToken, { installationId: conn.config.installationId });
    } catch {
      return;
    }
    const since = Math.max(conn.lastScannedAt ?? 0, Date.now() - LOOKBACK);
    const items: { externalId: string; title: string; text: string; author: string; url?: string; createdAt: number }[] = [];
    for (const repo of conn.config.repos) {
      const pulls = await github<PullRequest[]>(
        `/repos/${repo.fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
        token,
      ).catch(() => []);
      for (const pull of pulls) {
        if (!pull.merged_at || Date.parse(pull.merged_at) < since) continue;
        const labels = pull.labels.map((label) => label.name).join(", ");
        items.push({
          externalId: `pr:${repo.fullName}#${pull.number}`,
          title: `${repo.fullName} pull request #${pull.number}`,
          text: [
            `Merged pull request: ${pull.title}`,
            labels ? `Labels: ${labels}` : "",
            (pull.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim().slice(0, 6000),
          ]
            .filter(Boolean)
            .join("\n\n"),
          author: pull.user?.login ?? "someone",
          url: pull.html_url,
          createdAt: Date.parse(pull.merged_at),
        });
      }
      const releases = await github<Release[]>(`/repos/${repo.fullName}/releases?per_page=10`, token).catch(() => []);
      for (const release of releases) {
        if (release.draft || !release.published_at || Date.parse(release.published_at) < since) continue;
        items.push({
          externalId: `release:${repo.fullName}:${release.id}`,
          title: `${repo.fullName} release ${release.tag_name}`,
          text: [`Release ${release.name || release.tag_name}`, (release.body ?? "").trim().slice(0, 8000)].filter(Boolean).join("\n\n"),
          author: release.author?.login ?? "someone",
          url: release.html_url,
          createdAt: Date.parse(release.published_at),
        });
      }
    }
    const useful = items.filter((item) => item.text.length >= 40);
    if (useful.length) {
      await ctx.runMutation(internal.sources.saveItems, { workspaceId: args.workspaceId, sourceId: conn.sourceId, items: useful });
    }
  },
});
