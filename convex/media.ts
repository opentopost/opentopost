import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireDraft } from "./drafts";

/*
 * Images, PDFs, and videos to post with a draft, and reposts of another LinkedIn post.
 * LinkedIn takes one kind of media per post: up to 9 images, or one PDF, or one video.
 * A repost carries only text, so a draft is either a repost or a post with media.
 */

export const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function kindFor(contentType: string): "image" | "document" | "video" | null {
  if (/^image\/(png|jpeg|gif)$/.test(contentType)) return "image";
  if (contentType === "application/pdf") return "document";
  if (contentType === "video/mp4") return "video";
  return null;
}

function editable(draft: Doc<"drafts">) {
  if ((draft.channel ?? "linkedin") !== "linkedin") throw new ConvexError("Media and reposts are for LinkedIn posts.");
  if (draft.status === "posted") throw new ConvexError("This draft is already posted.");
  if (draft.schedule?.state === "scheduled" || draft.schedule?.state === "publishing") {
    throw new ConvexError("Cancel the schedule before you change the media.");
  }
}

export const uploadUrl = mutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await requireDraft(ctx, args.draftId);
    editable(draft);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: { draftId: v.id("drafts"), storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, args) => {
    const draft = await requireDraft(ctx, args.draftId);
    const meta = await ctx.db.system.get(args.storageId);
    const reject = async (message: string) => {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError(message);
    };
    if (!meta) throw new ConvexError("The upload did not finish. Try again.");
    try {
      editable(draft);
    } catch (error) {
      await ctx.storage.delete(args.storageId);
      throw error;
    }
    const contentType = meta.contentType ?? "";
    const kind = kindFor(contentType);
    if (!kind) return reject("Use a PNG, JPG, or GIF image, a PDF, or an MP4 video.");
    if (draft.repostOf) return reject("A repost can only have text. Remove the repost to add media.");
    const media = draft.media ?? [];
    if (media.length && media[0].kind !== kind) return reject("A LinkedIn post takes one kind of media: images, or one PDF, or one video.");
    if (kind === "image" && media.length >= MAX_IMAGES) return reject(`A post can have up to ${MAX_IMAGES} images.`);
    if (kind !== "image" && media.length >= 1) return reject(`A post can have one ${kind === "video" ? "video" : "PDF"}.`);
    const limit = kind === "image" ? MAX_IMAGE_BYTES : kind === "document" ? MAX_DOCUMENT_BYTES : MAX_VIDEO_BYTES;
    if (meta.size > limit) return reject(`That file is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`);
    await ctx.db.patch(draft._id, {
      media: [...media, { storageId: args.storageId, kind, name: args.name.slice(0, 120) || "file", contentType, size: meta.size }],
      updatedAt: Date.now(),
    });
  },
});

export const detach = mutation({
  args: { draftId: v.id("drafts"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const draft = await requireDraft(ctx, args.draftId);
    editable(draft);
    const media = draft.media ?? [];
    if (!media.some((row) => row.storageId === args.storageId)) return;
    await ctx.db.patch(draft._id, { media: media.filter((row) => row.storageId !== args.storageId), updatedAt: Date.now() });
    await ctx.storage.delete(args.storageId);
  },
});

/** Reads the post id from a LinkedIn post link or URN. */
export function parseLinkedInPost(input: string): { kind: string; id: string } | null {
  const text = input.trim();
  const urn = text.match(/urn:li:(activity|share|ugcPost):(\d{10,25})/);
  if (urn) return { kind: urn[1], id: urn[2] };
  const slug = text.match(/linkedin\.com\/posts\/[^?#]*?-(activity|share|ugcPost)-(\d{10,25})/);
  if (slug) return { kind: slug[1], id: slug[2] };
  return null;
}

export const setRepost = mutation({
  args: { draftId: v.id("drafts"), url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const draft = await requireDraft(ctx, args.draftId);
    editable(draft);
    if (args.url === null || !args.url.trim()) {
      await ctx.db.patch(draft._id, { repostOf: undefined, updatedAt: Date.now() });
      return;
    }
    const parsed = parseLinkedInPost(args.url);
    if (!parsed) throw new ConvexError("Paste the link to a LinkedIn post. On the post, click the three dots, then Embed this post, and paste the code or link.");
    if ((draft.media ?? []).length) throw new ConvexError("A repost can only have text. Remove the media first.");
    await ctx.db.patch(draft._id, { repostOf: { url: args.url.trim().slice(0, 500), ...parsed }, updatedAt: Date.now() });
  },
});

/** Media with links for the app, in the order they were added. */
export async function mediaForView(ctx: QueryCtx, draft: Doc<"drafts">) {
  return Promise.all(
    (draft.media ?? []).map(async (row) => ({ ...row, url: await ctx.storage.getUrl(row.storageId) })),
  );
}
