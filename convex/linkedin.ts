import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { decrypt, encrypt } from "./lib/crypto";
import { randomState } from "./oauth";

const SCOPES = "openid profile w_member_social";

const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const redirectUri = () => `${process.env.CONVEX_SITE_URL}/linkedin/oauth`;
export const linkedinConfigured = () => Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

/** LinkedIn supports each monthly API version for a year. Default to the version from two months ago. */
function apiVersion(): string {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 2);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** LinkedIn's post text format treats some characters as markup. Escape them, and keep hashtags as hashtags. */
export function toCommentary(text: string): string {
  const escape = (part: string) => part.replace(/[\\|{}@[\]()<>#*_~]/g, (char) => `\\${char}`);
  let out = "";
  let last = 0;
  for (const match of text.matchAll(/(^|\s)#([A-Za-z][A-Za-z0-9]{0,99})\b/g)) {
    const start = (match.index ?? 0) + match[1].length;
    out += escape(text.slice(last, start)) + `{hashtag|\\#|${match[2]}}`;
    last = start + 1 + match[2].length;
  }
  return out + escape(text.slice(last));
}

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const linkedin = member.linkedin;
    return {
      available: linkedinConfigured(),
      connected: Boolean(linkedin && linkedin.expiresAt > Date.now()),
      expired: Boolean(linkedin && linkedin.expiresAt <= Date.now()),
      name: linkedin?.name ?? null,
      expiresAt: linkedin?.expiresAt ?? null,
    };
  },
});

export const memberFor = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => (await requireMember(ctx, args.workspaceId))._id,
});

export const startOAuth = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<string> => {
    if (!linkedinConfigured()) throw new ConvexError("LinkedIn is not set up on this deployment.");
    const memberId = await ctx.runQuery(internal.linkedin.memberFor, args);
    const state = randomState();
    await ctx.runMutation(internal.oauth.saveState, { provider: "linkedin", state, workspaceId: args.workspaceId, memberId });
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES);
    return url.toString();
  },
});

export const completeOAuth = internalAction({
  args: { code: v.optional(v.string()), state: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const back = (result: string) => `${siteUrl()}/calendar?linkedin=${result}`;
    if (!args.state) return back("expired");
    const target = await ctx.runMutation(internal.oauth.consumeState, { provider: "linkedin", state: args.state });
    if (!target) return back("expired");
    if (args.error || !args.code) return back("cancelled");
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: redirectUri(),
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const token = (await tokenResponse.json()) as { access_token?: string; expires_in?: number };
    if (!token.access_token) return back("error");
    const infoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!infoResponse.ok) return back("error");
    const info = (await infoResponse.json()) as { sub: string; name?: string };
    const sealed = await encrypt(token.access_token);
    await ctx.runMutation(internal.linkedin.saveConnection, {
      memberId: target.memberId,
      sub: info.sub,
      name: info.name ?? "LinkedIn member",
      expiresAt: Date.now() + (token.expires_in ?? 60 * 24 * 3600) * 1000,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      last4: token.access_token.slice(-4),
    });
    return back("connected");
  },
});

export const saveConnection = internalMutation({
  args: {
    memberId: v.id("members"),
    sub: v.string(),
    name: v.string(),
    expiresAt: v.number(),
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return;
    const label = `linkedin:${member._id}`;
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) => q.eq("workspaceId", member.workspaceId).eq("kind", "linkedin").eq("label", label))
      .unique();
    const fields = { ciphertext: args.ciphertext, iv: args.iv, last4: args.last4, testedAt: Date.now(), testOk: true };
    if (secret) await ctx.db.patch(secret._id, fields);
    else await ctx.db.insert("secrets", { workspaceId: member.workspaceId, kind: "linkedin", label, ...fields });
    await ctx.db.patch(member._id, {
      linkedin: { sub: args.sub, name: args.name, expiresAt: args.expiresAt, connectedAt: Date.now() },
    });
  },
});

export const disconnect = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.workspaceId);
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q.eq("workspaceId", member.workspaceId).eq("kind", "linkedin").eq("label", `linkedin:${member._id}`),
      )
      .unique();
    if (secret) await ctx.db.delete(secret._id);
    await ctx.db.patch(member._id, { linkedin: undefined });
  },
});

export const publishInput = internalQuery({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    const member = await ctx.db.get(draft.memberId);
    if (!member?.linkedin) return { draft, error: "Connect LinkedIn on the Calendar page to publish." };
    if (member.linkedin.expiresAt <= Date.now()) return { draft, error: "Your LinkedIn connection expired. Connect it again on the Calendar page." };
    const secret = await ctx.db
      .query("secrets")
      .withIndex("by_workspace_kind_label", (q) =>
        q.eq("workspaceId", member.workspaceId).eq("kind", "linkedin").eq("label", `linkedin:${member._id}`),
      )
      .unique();
    if (!secret) return { draft, error: "Connect LinkedIn on the Calendar page to publish." };
    return { draft, sub: member.linkedin.sub, ciphertext: secret.ciphertext, iv: secret.iv };
  },
});

type Upload = { kind: "image" | "document" | "video"; name: string; blob: Blob };

function liHeaders(token: string, json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
    "LinkedIn-Version": apiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function liError(response: Response, what: string): Promise<Error> {
  if (response.status === 401) return new Error("Your LinkedIn connection expired. Connect it again on the Calendar page.");
  const detail = (await response.text()).slice(0, 200);
  return new Error(`LinkedIn returned ${response.status} while ${what}. ${detail}`.trim());
}

/** Uploads one image or PDF and returns its LinkedIn URN. */
async function uploadAsset(token: string, owner: string, file: Upload): Promise<string> {
  const path = file.kind === "image" ? "images" : "documents";
  const init = await fetch(`https://api.linkedin.com/rest/${path}?action=initializeUpload`, {
    method: "POST",
    headers: liHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!init.ok) throw await liError(init, `preparing ${file.name}`);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image?: string; document?: string } };
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: file.blob });
  if (!put.ok) throw await liError(put, `uploading ${file.name}`);
  const urn = value.image ?? value.document;
  if (!urn) throw new Error(`LinkedIn did not return an id for ${file.name}.`);
  return urn;
}

/** Uploads a video in the parts LinkedIn asks for, then waits until LinkedIn has processed it. */
async function uploadVideo(token: string, owner: string, file: Upload): Promise<string> {
  const init = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
    method: "POST",
    headers: liHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: file.blob.size, uploadCaptions: false, uploadThumbnail: false } }),
  });
  if (!init.ok) throw await liError(init, `preparing ${file.name}`);
  const { value } = (await init.json()) as {
    value: { video: string; uploadToken?: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] };
  };
  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: file.blob.slice(part.firstByte, part.lastByte + 1),
    });
    if (!put.ok) throw await liError(put, `uploading ${file.name}`);
    etags.push((put.headers.get("etag") ?? "").replace(/"/g, ""));
  }
  const done = await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST",
    headers: liHeaders(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken ?? "", uploadedPartIds: etags } }),
  });
  if (!done.ok) throw await liError(done, `finishing ${file.name}`);
  // LinkedIn processes the video before a post can use it. Wait up to about two minutes.
  for (let i = 0; i < 24; i++) {
    const check = await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(value.video)}`, { headers: liHeaders(token, false) });
    if (check.ok) {
      const body = (await check.json()) as { status?: string };
      if (body.status === "AVAILABLE") return value.video;
      if (body.status === "PROCESSING_FAILED") throw new Error(`LinkedIn could not process ${file.name}. Try an MP4 in H.264.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`LinkedIn is still processing ${file.name}. Try again in a few minutes.`);
}

/** Publishes one draft to the author's own LinkedIn profile: text, text with media, or a repost with text. */
export const publish = internalAction({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args): Promise<void> => {
    const input = await ctx.runQuery(internal.linkedin.publishInput, args);
    if (!input) return;
    if (!("sub" in input) || !input.sub) {
      await ctx.runMutation(internal.schedule.markFailed, { draftId: args.draftId, error: input.error ?? "LinkedIn is not connected." });
      return;
    }
    const { draft } = input;
    const text = [draft.hook ?? draft.hooks[0] ?? "", draft.body].filter(Boolean).join("\n\n").trim();
    const owner = `urn:li:person:${input.sub}`;
    try {
      const token = await decrypt(input.ciphertext, input.iv);
      const base = {
        author: owner,
        commentary: toCommentary(text),
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };

      // A repost: LinkedIn wants the share or ugcPost id. Links usually carry the activity id, which is
      // the same number for most posts, so try the likely kinds in turn.
      const parents = draft.repostOf
        ? [...new Set([draft.repostOf.kind === "ugcPost" ? "ugcPost" : "share", "share", "ugcPost"])].map(
            (kind) => `urn:li:${kind}:${draft.repostOf!.id}`,
          )
        : [];

      let content: Record<string, unknown> | undefined;
      const files: Upload[] = [];
      for (const row of draft.media ?? []) {
        const blob = await ctx.storage.get(row.storageId);
        if (!blob) throw new Error(`${row.name} is missing. Remove it and add it again.`);
        files.push({ kind: row.kind, name: row.name, blob });
      }
      if (files.length) {
        if (files[0].kind === "video") {
          content = { media: { title: files[0].name, id: await uploadVideo(token, owner, files[0]) } };
        } else if (files[0].kind === "document") {
          content = { media: { title: files[0].name.replace(/\.pdf$/i, ""), id: await uploadAsset(token, owner, files[0]) } };
        } else {
          const urns: string[] = [];
          for (const file of files) urns.push(await uploadAsset(token, owner, file));
          content = urns.length === 1 ? { media: { id: urns[0] } } : { multiImage: { images: urns.map((id) => ({ id })) } };
        }
      }

      const attempts = parents.length ? parents.map((parent) => ({ ...base, reshareContext: { parent } })) : [{ ...base, ...(content ? { content } : {}) }];
      let response: Response | null = null;
      for (const body of attempts) {
        response = await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: liHeaders(token), body: JSON.stringify(body) });
        if (response.ok || response.status === 401) break;
        if (!parents.length || ![400, 404, 422].includes(response.status)) break;
      }
      if (!response || !response.ok) {
        if (parents.length && response && response.status !== 401) {
          throw new Error("LinkedIn would not repost that post. On the post, click the three dots, then Embed this post, and paste that link as the repost. If it still fails, the author has turned off reposts.");
        }
        throw await liError(response!, "publishing");
      }
      const urn = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id");
      const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : "https://www.linkedin.com/feed/";
      await ctx.runMutation(internal.schedule.markPublished, { draftId: args.draftId, url });
    } catch (error) {
      await ctx.runMutation(internal.schedule.markFailed, {
        draftId: args.draftId,
        error: error instanceof Error ? error.message : "Publishing failed.",
      });
    }
  },
});
