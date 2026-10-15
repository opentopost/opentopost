import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation } from "./_generated/server";

/*
 * First-party product analytics: page views, clicks, scroll depth, and active time
 * from the website and the app. No cookies; the browser keeps a random visitor id.
 * Only the admin dashboard reads it.
 */

const DAY = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 400;
const MAX_EVENTS = 60;

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
const num = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined;

const context = v.object({
  visitorId: v.string(),
  sessionId: v.string(),
  host: v.string(),
  referrer: v.optional(v.string()),
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  device: v.string(),
  browser: v.optional(v.string()),
  os: v.optional(v.string()),
  timezone: v.optional(v.string()),
  language: v.optional(v.string()),
  memberId: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
});

const event = v.object({
  type: v.union(v.literal("pageview"), v.literal("click"), v.literal("engage")),
  at: v.number(),
  path: v.string(),
  title: v.optional(v.string()),
  label: v.optional(v.string()),
  href: v.optional(v.string()),
  activeMs: v.optional(v.number()),
  scroll: v.optional(v.number()),
});

const APP_PREFIXES = ["/dashboard", "/ideas", "/moments", "/drafts", "/calendar", "/review", "/recap", "/sources", "/voice", "/company", "/settings", "/onboarding", "/start", "/invite", "/billing", "/insights"];
const inApp = (path: string) => APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export const ingest = internalMutation({
  args: { context, events: v.array(event) },
  handler: async (ctx, { context: c, events }) => {
    if (events.length === 0) return;
    const now = Date.now();
    for (const e of events) {
      await ctx.db.insert("analyticsEvents", {
        ...e,
        at: Math.min(e.at, now),
        visitorId: c.visitorId,
        sessionId: c.sessionId,
        host: c.host,
        referrer: e.type === "pageview" ? c.referrer : undefined,
        memberId: c.memberId,
        workspaceId: c.workspaceId,
      });
    }

    const pageviews = events.filter((e) => e.type === "pageview");
    const clicks = events.filter((e) => e.type === "click").length;
    const engaged = events.filter((e) => e.type === "engage");
    const activeMs = engaged.reduce((sum, e) => sum + (e.activeMs ?? 0), 0);
    const scroll = Math.max(0, ...engaged.map((e) => e.scroll ?? 0));
    const first = events[0];
    const last = events[events.length - 1];
    const anyApp = events.some((e) => inApp(e.path));

    const session = await ctx.db
      .query("analyticsSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", c.sessionId))
      .unique();
    if (session) {
      await ctx.db.patch(session._id, {
        lastAt: Math.max(session.lastAt, Math.min(last.at, now)),
        exitPath: pageviews.length ? pageviews[pageviews.length - 1].path : session.exitPath,
        pages: session.pages + pageviews.length,
        clicks: session.clicks + clicks,
        activeMs: session.activeMs + activeMs,
        maxScroll: Math.max(session.maxScroll, scroll),
        memberId: session.memberId ?? c.memberId,
        workspaceId: session.workspaceId ?? c.workspaceId,
        inApp: session.inApp || anyApp,
      });
    } else {
      await ctx.db.insert("analyticsSessions", {
        sessionId: c.sessionId,
        visitorId: c.visitorId,
        startedAt: Math.min(first.at, now),
        lastAt: Math.min(last.at, now),
        entryPath: (pageviews[0] ?? first).path,
        exitPath: (pageviews[pageviews.length - 1] ?? last).path,
        pages: pageviews.length,
        clicks,
        activeMs,
        maxScroll: scroll,
        referrer: c.referrer,
        utmSource: c.utmSource,
        utmMedium: c.utmMedium,
        utmCampaign: c.utmCampaign,
        device: c.device,
        browser: c.browser,
        os: c.os,
        timezone: c.timezone,
        language: c.language,
        memberId: c.memberId,
        workspaceId: c.workspaceId,
        inApp: anyApp,
      });
    }
  },
});

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1") return true;
  const site = process.env.SITE_URL;
  if (!site) return false;
  const siteHost = new URL(site).hostname.replace(/^www\./, "");
  return host === siteHost || host.endsWith(`.${siteHost}`);
}

/** POST /t from the browser tracker. Sent with sendBeacon as text/plain, so no preflight. */
export const collect = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (!allowedOrigin(origin)) return new Response(null, { status: 204 });
  let body: { context?: Record<string, unknown>; events?: Record<string, unknown>[] };
  try {
    const text = await request.text();
    if (text.length > 64_000) return new Response(null, { status: 204 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  const c = body.context ?? {};
  const visitorId = clip(c.visitorId, 64);
  const sessionId = clip(c.sessionId, 64);
  if (!visitorId || !sessionId) return new Response(null, { status: 204 });
  const host = clip(c.host, 120) ?? "unknown";
  if (host.startsWith("admin.")) return new Response(null, { status: 204 });

  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_EVENTS)
    .flatMap((e) => {
      const type = e.type === "pageview" || e.type === "click" || e.type === "engage" ? (e.type as "pageview" | "click" | "engage") : null;
      const path = clip(e.path, 300);
      const at = num(e.at, 0, Date.now() + 60_000);
      if (!type || !path || at === undefined) return [];
      return [
        {
          type,
          at,
          path,
          title: clip(e.title, 160),
          label: clip(e.label, 120),
          href: clip(e.href, 300),
          activeMs: num(e.activeMs, 0, 6 * 60 * 60 * 1000),
          scroll: num(e.scroll, 0, 100),
        },
      ];
    });

  await ctx.runMutation(internal.analytics.ingest, {
    context: {
      visitorId,
      sessionId,
      host,
      referrer: clip(c.referrer, 300),
      utmSource: clip(c.utmSource, 80),
      utmMedium: clip(c.utmMedium, 80),
      utmCampaign: clip(c.utmCampaign, 120),
      device: clip(c.device, 20) ?? "desktop",
      browser: clip(c.browser, 40),
      os: clip(c.os, 40),
      timezone: clip(c.timezone, 60),
      language: clip(c.language, 20),
      memberId: clip(c.memberId, 64),
      workspaceId: clip(c.workspaceId, 64),
    },
    events,
  });
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin ?? "*" } });
});

/** Deletes raw events older than KEEP_DAYS, a batch at a time. Sessions are kept. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_DAYS * DAY;
    const old = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(500);
    for (const row of old) await ctx.db.delete(row._id);
    if (old.length === 500) await ctx.scheduler.runAfter(0, internal.analytics.prune, {});
  },
});
