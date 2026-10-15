import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireMember, requireOwner } from "./lib/auth";
import { deploymentMode } from "./lib/limits";
import { weekOf } from "./lib/week";
import { buildRecap } from "./recaps";

/*
 * Sample data for self-hosted workspaces: three teammates, a month of posts with
 * tracked links, clicks and signups, and a week of scheduled drafts. It exists so
 * a new install (and our own screenshots) shows what a busy week looks like.
 * Everything it creates is marked and can be removed in one step.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MARK = "sample";
const DEMO_PREFIX = "demo:";

const PEOPLE = [
  { key: "tunde", name: "Tunde Adebayo", goal: 2 },
  { key: "kemi", name: "Kemi Okafor", goal: 2 },
  { key: "ada", name: "Ada Obi", goal: 1 },
] as const;

type Who = (typeof PEOPLE)[number]["key"] | "owner" | "company";

type SamplePost = {
  who: Who;
  /** Weeks back from this week; 0 is this week. */
  week: number;
  /** Hours after the start of that week (Monday 00:00 UTC). */
  at: number;
  title: string;
  hooks: [string, string, string];
  body: string;
  target: string;
  clicks: number;
  signups: number;
  demos?: number;
};

type SampleScheduled = {
  who: Who;
  /** Hours from now. */
  inHours: number;
  title: string;
  hooks: [string, string, string];
  body: string;
  review?: boolean;
};

const SITE = "https://relaybase.example";

const POSTS: SamplePost[] = [
  {
    who: "tunde",
    week: 3,
    at: 9 + 24,
    title: "Our webhook retries were too polite",
    hooks: ["Our webhook retries were too polite.", "We retried failed webhooks 3 times. Then we gave up. That was the bug.", "The fix for missed webhooks was not more retries."],
    body: "Our webhook retries were too polite.\n\nWe tried three times in the first minute, then gave up. Most failures we saw were a receiver deploying, which takes longer than a minute.\n\nWe moved to backoff over 24 hours. Failed deliveries that never recovered dropped to almost none.\n\nIf you run webhooks, look at when your receivers actually fail before you tune retries.",
    target: `${SITE}/blog/retries`,
    clicks: 46,
    signups: 2,
  },
  {
    who: "ada",
    week: 3,
    at: 15 + 72,
    title: "Empty states are onboarding",
    hooks: ["Empty states are onboarding.", "The first screen most people see is an empty one.", "We redesigned one empty state and support tickets about setup went quiet."],
    body: "Empty states are onboarding.\n\nThe event log is the first page most new users open, and it was blank with the word \"Nothing yet\".\n\nNow it shows a test event you can send with one click, and what a real one will look like.\n\nDesign the empty screen first. It is the one everyone sees.",
    target: `${SITE}/changelog`,
    clicks: 31,
    signups: 1,
  },
  {
    who: "kemi",
    week: 2,
    at: 10 + 24,
    title: "What 12 customer calls taught me about webhook security",
    hooks: ["I asked 12 customers how they verify our webhooks.", "Most teams do not check webhook signatures. Here is why.", "Signature checks fail for boring reasons."],
    body: "I asked 12 customers how they verify our webhooks.\n\nHalf were not checking signatures at all. Not because they did not care, but because the docs made it look hard.\n\nWe rewrote the guide with one copy-paste snippet per language.\n\nSecurity that takes 20 minutes to set up does not get set up.",
    target: `${SITE}/docs/signatures`,
    clicks: 58,
    signups: 3,
    demos: 1,
  },
  {
    who: "tunde",
    week: 2,
    at: 9 + 72,
    title: "Idempotency keys saved our biggest customer's Black Friday",
    hooks: ["One header saved a customer's busiest day.", "Duplicate webhooks are not a bug. Ignoring them is.", "Idempotency keys are boring. That is the point."],
    body: "One header saved a customer's busiest day.\n\nEvery event we send has an idempotency key. On their peak day a network blip made us resend a batch. Their system saw the keys and skipped the duplicates.\n\nNo double orders. No support tickets.\n\nBoring infrastructure is the kind you want on a busy day.",
    target: `${SITE}/docs/idempotency`,
    clicks: 72,
    signups: 4,
  },
  {
    who: "owner",
    week: 2,
    at: 16 + 96,
    title: "We almost built the wrong dashboard",
    hooks: ["We almost built the wrong dashboard.", "Our customers did not want more charts.", "The most requested feature was a search box."],
    body: "We almost built the wrong dashboard.\n\nThe plan had six charts. Then we read every support ticket from the last quarter.\n\nPeople did not want charts. They wanted to find one event fast.\n\nWe shipped search first. The charts are still on the list.",
    target: `${SITE}/blog/search`,
    clicks: 64,
    signups: 3,
  },
  {
    who: "kemi",
    week: 1,
    at: 11 + 24,
    title: "Polling is a tax you pay every minute",
    hooks: ["Polling is a tax you pay every minute.", "Most API traffic we see is asking \"anything new?\"", "We counted how many polling requests return nothing."],
    body: "Polling is a tax you pay every minute.\n\nWhen customers switch to webhooks, most of the requests they stop sending were returning nothing new.\n\nYou pay for every one of those calls in compute and in delay.\n\nIf you poll more than once a minute, it is worth an afternoon to try webhooks.",
    target: `${SITE}/docs/quickstart`,
    clicks: 83,
    signups: 5,
    demos: 1,
  },
  {
    who: "ada",
    week: 1,
    at: 14 + 48,
    title: "We removed a setting and nobody noticed",
    hooks: ["We removed a setting and nobody noticed.", "The best settings page is a shorter one.", "Every setting is a question you ask your user."],
    body: "We removed a setting and nobody noticed.\n\nIt let you choose the payload format. Almost everyone left the default, and the rest asked support what it meant.\n\nNow there is one format, and it is documented well.\n\nEvery setting is a question you ask your user. Ask fewer.",
    target: `${SITE}/changelog`,
    clicks: 39,
    signups: 1,
  },
  {
    who: "tunde",
    week: 1,
    at: 9 + 72,
    title: "Why our status page shows p99, not averages",
    hooks: ["Averages hide the deliveries people complain about.", "Our status page shows p99. Here is why.", "Nobody files a ticket about the average."],
    body: "Averages hide the deliveries people complain about.\n\nOur average delivery time looked great while a few customers waited far too long.\n\nWe moved the status page to p99, and it changed what we fixed first.\n\nNobody files a ticket about the average.",
    target: `${SITE}/status`,
    clicks: 52,
    signups: 2,
  },
  {
    who: "company",
    week: 1,
    at: 13 + 96,
    title: "Relaybase v2.7: delivery logs you can search",
    hooks: ["You can now search every webhook delivery.", "Relaybase v2.7 is out.", "Find any delivery in seconds."],
    body: "You can now search every webhook delivery.\n\nRelaybase v2.7 adds search across 30 days of delivery logs, by event, endpoint, or status.\n\nThanks to Ada for the design and Tunde for the indexing work.\n\nRead the changelog for the details.",
    target: `${SITE}/changelog/2-7`,
    clicks: 97,
    signups: 6,
    demos: 2,
  },
  {
    who: "tunde",
    week: 0,
    at: 9,
    title: "Event replay: debug a webhook without waiting for the next one",
    hooks: ["Debug a webhook without waiting for the next one.", "We shipped the feature I wanted most as a customer.", "Replay any event. Fix your handler. Replay again."],
    body: "Debug a webhook without waiting for the next one.\n\nEvent replay is live in v2.8. Pick any event from the last 30 days and send it again to your endpoint.\n\nFix your handler, replay, check, repeat. No more waiting for a real event to test a fix.\n\nThis was the feature I wanted most before I joined.",
    target: `${SITE}/changelog/2-8`,
    clicks: 210,
    signups: 14,
    demos: 2,
  },
  {
    who: "kemi",
    week: 0,
    at: 10 + 24,
    title: "Shipped the Go SDK. No dependencies. Three weekends.",
    hooks: ["Shipped the Go SDK. No dependencies. Three weekends.", "Our Go SDK uses only the standard library.", "Every dependency is a risk you sign up for."],
    body: "Shipped the Go SDK. No dependencies. Three weekends.\n\nIt uses only the Go standard library. Nothing to audit, nothing to update when a package you never heard of breaks.\n\nGo teams asked for this more than any other language.\n\nIt is open source, and pull requests are welcome.",
    target: `${SITE}/docs/go`,
    clicks: 164,
    signups: 9,
  },
  {
    who: "company",
    week: 0,
    at: 15 + 24,
    title: "Relaybase v2.8 is out",
    hooks: ["Relaybase v2.8 is out: event replay and a Go SDK.", "Two things you asked for, shipped.", "Replay any event. Use Go without extra dependencies."],
    body: "Relaybase v2.8 is out: event replay and a Go SDK.\n\nReplay any event from the last 30 days to test a fix. Tunde built it.\n\nThe Go SDK has no dependencies outside the standard library. Kemi wrote it.\n\nFull changelog below.",
    target: `${SITE}/changelog/2-8`,
    clicks: 96,
    signups: 5,
    demos: 1,
  },
];

const SCHEDULED: SampleScheduled[] = [
  {
    who: "owner",
    inHours: 30,
    title: "Three things we learned shipping v2.8",
    hooks: ["Three things we learned shipping v2.8.", "v2.8 took four weeks. Here is what we would do again.", "What shipping two features at once taught us."],
    body: "Three things we learned shipping v2.8.\n\n1. Ship the docs with the feature, not after.\n2. Let the person who built it announce it.\n3. A changelog is a product page. Write it like one.",
  },
  {
    who: "owner",
    inHours: 0,
    title: "Why our support team reads every pull request title",
    hooks: ["Our support team reads every pull request title.", "Support knew about the fix before the customer asked.", "The cheapest way to make support faster."],
    body: "Our support team reads every pull request title.\n\nWhen a customer asks about a bug, support often already knows a fix is coming, and when.\n\nIt costs five minutes a day.",
  },
  {
    who: "kemi",
    inHours: 14,
    title: "Northwind stopped polling our API",
    hooks: ["Northwind stopped polling our API last month.", "A logistics team cut delivery time to under 2 seconds.", "What changed when Northwind moved to webhooks."],
    body: "Northwind stopped polling our API last month.\n\nTheir deliveries now land in under 2 seconds instead of 30. Their ops team noticed before we told them.\n\nWhat changed: one endpoint, signature checks, and retries they no longer write themselves.",
  },
  {
    who: "ada",
    inHours: 32,
    title: "Designing the replay button",
    hooks: ["A replay button should feel safe to press.", "We redesigned one button four times.", "The hardest part of event replay was the button."],
    body: "A replay button should feel safe to press.\n\nOur first version looked like it would resend to every endpoint. People were scared to click it.\n\nNow it shows exactly where the event goes before you send it.",
  },
  {
    who: "company",
    inHours: 34,
    review: true,
    title: "How Northwind cut delivery time with webhooks",
    hooks: ["Northwind moved from polling to webhooks.", "Delivery time: 30 seconds to under 2.", "A customer story from Northwind Logistics."],
    body: "Northwind Logistics moved from polling to Relaybase webhooks.\n\nTheir delivery updates now arrive in under 2 seconds instead of 30.\n\nThanks to Kemi for working with their team on the switch.",
  },
  {
    who: "tunde",
    inHours: 56,
    title: "What retry backoff taught us about our customers",
    hooks: ["Retries tell you when your customers deploy.", "Our retry logs became a map of customer deploys.", "The pattern hiding in failed webhooks."],
    body: "Retries tell you when your customers deploy.\n\nMost failed deliveries cluster in short windows on weekday afternoons. That is when receivers restart.\n\nWe now delay the first retry slightly, and far fewer events need a second one.",
  },
];

/** Small deterministic random numbers, so the sample looks the same each time. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

async function demoMembers(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return members.filter((member) => member.kindeUserId.startsWith(DEMO_PREFIX));
}

async function sampleDrafts(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const drafts = await ctx.db
    .query("drafts")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return drafts.filter((draft) => draft.channel === MARK);
}

function assertSelfHosted() {
  if (deploymentMode() !== "selfhosted") throw new ConvexError("Sample data is only available on self-hosted installs.");
}

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    if (deploymentMode() !== "selfhosted") return { available: false, loaded: false };
    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return { available: true, loaded: drafts.some((draft) => draft.channel === MARK) };
  },
});

export const seed = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    assertSelfHosted();
    const owner = await requireOwner(ctx, args.workspaceId);
    if ((await sampleDrafts(ctx, args.workspaceId)).length > 0) throw new ConvexError("Sample data is already loaded.");

    const now = Date.now();
    const thisWeek = Date.parse(`${weekOf(now)}T00:00:00Z`);
    const random = seeded(42);

    const ids: Record<Who, Id<"members">> = { owner: owner._id, company: owner._id } as Record<Who, Id<"members">>;
    const existing = await demoMembers(ctx, args.workspaceId);
    for (const person of PEOPLE) {
      const found = existing.find((member) => member.kindeUserId === `${DEMO_PREFIX}${person.key}`);
      ids[person.key] =
        found?._id ??
        (await ctx.db.insert("members", {
          workspaceId: args.workspaceId,
          kindeUserId: `${DEMO_PREFIX}${person.key}`,
          role: "member",
          name: person.name,
          weeklyGoal: person.goal,
          lastActiveAt: now - random() * 2 * DAY,
        }));
    }
    if (!owner.weeklyGoal) await ctx.db.patch(owner._id, { weeklyGoal: 2 });

    const weeks = new Set<string>();
    for (const sample of POSTS) {
      let postedAt = thisWeek - sample.week * WEEK + sample.at * HOUR;
      // This week's posts must already have happened.
      if (postedAt > now - 2 * HOUR) postedAt = Math.max(thisWeek + HOUR, now - 2 * HOUR - random() * 6 * HOUR);
      weeks.add(weekOf(postedAt));

      const draftId = await ctx.db.insert("drafts", {
        workspaceId: args.workspaceId,
        channel: MARK,
        memberId: ids[sample.who],
        voice: sample.who === "company" ? "company" : undefined,
        reviewState: sample.who === "company" ? "approved" : "none",
        title: sample.title,
        hooks: sample.hooks,
        hook: sample.hooks[0],
        body: `${sample.body}\n\n${sample.target}`,
        generatedBody: sample.body,
        updatedAt: postedAt,
        revisions: [],
        status: "posted",
        scheduledAt: postedAt,
      });
      const postId = await ctx.db.insert("posts", {
        workspaceId: args.workspaceId,
        draftId,
        memberId: ids[sample.who],
        linkedinUrl: `https://www.linkedin.com/feed/?sample=${POSTS.indexOf(sample) + 1}`,
        postedAt,
      });

      const clickWindow = Math.max(HOUR, Math.min(now, postedAt + 5 * DAY) - postedAt);
      const clickTimes = Array.from({ length: sample.clicks }, () => postedAt + Math.pow(random(), 2) * clickWindow).sort();
      const linkId = await ctx.db.insert("trackedLinks", {
        workspaceId: args.workspaceId,
        slug: `s${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`,
        targetUrl: sample.target,
        postId,
        draftId,
        memberId: ids[sample.who],
        clicks: sample.clicks,
        createdAt: postedAt - 10 * 60 * 1000,
      });
      for (const at of clickTimes) {
        await ctx.db.insert("linkClicks", { trackedLinkId: linkId, at, referrer: random() < 0.8 ? "linkedin.com" : undefined });
      }
      const conversions: Doc<"conversions">["type"][] = [
        ...Array.from({ length: sample.signups }, () => "signup" as const),
        ...Array.from({ length: sample.demos ?? 0 }, () => "demo" as const),
      ];
      for (const type of conversions) {
        const at = clickTimes[Math.floor(random() * clickTimes.length)] + 5 * 60 * 1000;
        await ctx.db.insert("conversions", { workspaceId: args.workspaceId, trackedLinkId: linkId, type, at: Math.min(at, now) });
      }
    }

    for (const sample of SCHEDULED) {
      // On the hour, like a person would schedule it. Zero hours means not scheduled yet.
      const at = sample.inHours > 0 ? Math.ceil((now + sample.inHours * HOUR) / HOUR) * HOUR : undefined;
      await ctx.db.insert("drafts", {
        workspaceId: args.workspaceId,
        channel: MARK,
        memberId: ids[sample.who],
        voice: sample.who === "company" ? "company" : undefined,
        reviewState: sample.review ? "pending" : "none",
        review: sample.review ? { requestedAt: now - 3 * HOUR } : undefined,
        title: sample.title,
        hooks: sample.hooks,
        hook: sample.hooks[0],
        body: sample.body,
        generatedBody: sample.body,
        updatedAt: now - random() * 12 * HOUR,
        revisions: [],
        status: "ready",
        schedule: at ? { at, mode: "remind", state: "scheduled" } : undefined,
        scheduledAt: at,
      });
    }

    weeks.add(weekOf(now));
    for (const week of weeks) await buildRecap(ctx, args.workspaceId, week);
    return { posts: POSTS.length, scheduled: SCHEDULED.length, members: PEOPLE.length };
  },
});

export const clear = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    assertSelfHosted();
    await requireOwner(ctx, args.workspaceId);
    const weeks = new Set<string>([weekOf(Date.now())]);
    for (const draft of await sampleDrafts(ctx, args.workspaceId)) {
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
        .collect();
      for (const post of posts) {
        weeks.add(weekOf(post.postedAt));
        await ctx.db.delete(post._id);
      }
      const links = await ctx.db
        .query("trackedLinks")
        .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
        .collect();
      for (const link of links) {
        for (const click of await ctx.db
          .query("linkClicks")
          .withIndex("by_link", (q) => q.eq("trackedLinkId", link._id))
          .collect())
          await ctx.db.delete(click._id);
        for (const conversion of await ctx.db
          .query("conversions")
          .withIndex("by_link", (q) => q.eq("trackedLinkId", link._id))
          .collect())
          await ctx.db.delete(conversion._id);
        await ctx.db.delete(link._id);
      }
      await ctx.db.delete(draft._id);
    }
    for (const member of await demoMembers(ctx, args.workspaceId)) {
      const left = await ctx.db
        .query("drafts")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .first();
      if (!left) await ctx.db.delete(member._id);
    }
    for (const week of weeks) {
      const recap = await ctx.db
        .query("recaps")
        .withIndex("by_workspace_week", (q) => q.eq("workspaceId", args.workspaceId).eq("weekOf", week))
        .unique();
      if (recap) await buildRecap(ctx, args.workspaceId, week);
    }
    return null;
  },
});
