import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const provider = v.union(
  v.literal("google"),
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("openrouter"),
);

export const task = v.union(
  v.literal("scan"),
  v.literal("draft"),
  v.literal("score"),
);

export const role = v.union(v.literal("owner"), v.literal("admin"), v.literal("reviewer"), v.literal("member"));

/** Where a draft will be published. LinkedIn is the default. */
export const channel = v.union(
  v.literal("linkedin"),
  v.literal("x"),
  v.literal("changelog"),
  v.literal("investor_update"),
  v.literal("newsletter"),
);

const skillScope = v.union(v.literal("ideas"), v.literal("draft"));

export const reviewState = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("changes_requested"),
);

export const claim = v.object({
  text: v.string(),
  factIds: v.array(v.string()),
  status: v.union(v.literal("supported"), v.literal("unsupported"), v.literal("rule")),
  note: v.optional(v.string()),
});

export const fact = v.object({
  id: v.string(),
  text: v.string(),
  sourceItemId: v.optional(v.id("sourceItems")),
  quote: v.optional(v.string()),
});

export const conversionType = v.union(
  v.literal("signup"),
  v.literal("demo"),
  v.literal("application"),
  v.literal("purchase"),
);

export const voiceKind = v.union(
  v.literal("post"),
  v.literal("tweet"),
  v.literal("article"),
  v.literal("note"),
  v.literal("spoken"),
  v.literal("other"),
);

export const voiceOrigin = v.union(
  v.literal("paste"),
  v.literal("recording"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("image"),
  v.literal("link"),
);

export const plan = v.union(v.literal("free"), v.literal("pro"), v.literal("team"));


export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    kindeOrgCode: v.optional(v.string()),
    defaultProvider: v.optional(provider),
    timezone: v.string(),
    scanDay: v.number(),
    reviewRequired: v.optional(v.boolean()),
    conversionKey: v.optional(v.string()),
    billingOrgCode: v.optional(v.string()),
    useOwnKey: v.optional(v.boolean()),
    // Autopilot: approved-by-rule drafts publish without a person (see lib/ops.ts).
    autopilot: v.optional(v.boolean()),
    // Set on the read-only demo workspaces behind demo.opentopost.com. The value is the scenario key.
    demo: v.optional(v.string()),
    // Write each person's top idea for them after a scan. On unless set to false.
    autoDraft: v.optional(v.boolean()),
    // Hour of day (0-23, workspace time zone) used when a draft is approved without a time.
    postHour: v.optional(v.number()),
    // Days to keep raw source items. Unset keeps them until the workspace is deleted.
    retentionDays: v.optional(v.number()),
    // A free Team pilot run by hand. The Team plan stays on until endsAt plus graceDays (see manualPlan.until).
    pilot: v.optional(
      v.object({
        startedAt: v.number(),
        endsAt: v.number(),
        graceDays: v.number(),
        reminded5At: v.optional(v.number()),
        reminded1At: v.optional(v.number()),
        paymentSentAt: v.optional(v.number()),
        endedAt: v.optional(v.number()),
      }),
    ),
    // A plan set by hand from the admin dashboard, for teams that pay by invoice.
    manualPlan: v.optional(
      v.object({
        plan: v.union(v.literal("pro"), v.literal("team")),
        until: v.optional(v.number()),
        note: v.optional(v.string()),
        setAt: v.number(),
      }),
    ),
  })
    .index("by_kinde_org", ["kindeOrgCode"])
    .index("by_billing_org", ["billingOrgCode"])
    .index("by_conversion_key", ["conversionKey"])
    .index("by_demo", ["demo"]),

  members: defineTable({
    workspaceId: v.id("workspaces"),
    kindeUserId: v.string(),
    role,
    name: v.string(),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    lastActiveAt: v.optional(v.number()),
    weeklyGoal: v.optional(v.number()),
    // Autopilot only acts for people who turned it on for themselves. Unset means off.
    autopilotOptIn: v.optional(v.boolean()),
    // A person's own posting time zone and hour. Unset means the workspace default.
    timezone: v.optional(v.string()),
    postHour: v.optional(v.number()),
    linkedin: v.optional(
      v.object({ sub: v.string(), name: v.string(), expiresAt: v.number(), connectedAt: v.number() }),
    ),
    slackUserId: v.optional(v.string()),
  })
    .index("by_user", ["kindeUserId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "kindeUserId"]),

  invites: defineTable({
    workspaceId: v.id("workspaces"),
    token: v.string(),
    email: v.optional(v.string()),
    role,
    createdBy: v.id("members"),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.id("members")),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  teams: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
  }).index("by_workspace", ["workspaceId"]),

  secrets: defineTable({
    workspaceId: v.id("workspaces"),
    kind: v.union(
      v.literal("provider"),
      v.literal("slack"),
      v.literal("github"),
      v.literal("mcp"),
      v.literal("linkedin"),
      v.literal("connector"),
    ),
    label: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
    testedAt: v.optional(v.number()),
    testOk: v.optional(v.boolean()),
    testMessage: v.optional(v.string()),
  })
    .index("by_workspace_kind", ["workspaceId", "kind"])
    .index("by_workspace_kind_label", ["workspaceId", "kind", "label"]),

  modelDefaults: defineTable({
    provider,
    task,
    modelId: v.string(),
  }).index("by_provider_task", ["provider", "task"]),

  modelChoices: defineTable({
    workspaceId: v.id("workspaces"),
    provider,
    task,
    modelId: v.string(),
  }).index("by_workspace_provider_task", ["workspaceId", "provider", "task"]),

  sources: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("slack"),
      v.literal("github"),
      v.literal("notes"),
      v.literal("rss"),
      v.literal("mcp"),
      v.literal("linear"),
      v.literal("jira"),
      v.literal("notion"),
      v.literal("gdrive"),
      v.literal("intercom"),
      v.literal("zendesk"),
    ),
    config: v.any(),
    enabled: v.boolean(),
    lastScannedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

  sourceItems: defineTable({
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    externalId: v.string(),
    title: v.optional(v.string()),
    text: v.string(),
    author: v.optional(v.string()),
    url: v.optional(v.string()),
    createdAt: v.number(),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_source_external", ["sourceId", "externalId"])
    .index("by_source_created", ["sourceId", "createdAt"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  moments: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    summary: v.string(),
    kind: v.string(),
    facts: v.array(fact),
    sourceItemIds: v.array(v.id("sourceItems")),
    people: v.array(v.string()),
    occurredAt: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")),
    runId: v.optional(v.id("runs")),
  }).index("by_workspace_occurred", ["workspaceId", "occurredAt"]),

  ideas: defineTable({
    workspaceId: v.id("workspaces"),
    momentId: v.optional(v.id("moments")),
    channel: v.optional(v.string()),
    title: v.string(),
    angle: v.string(),
    score: v.number(),
    scores: v.optional(
      v.object({ novelty: v.number(), proof: v.number(), audienceFit: v.number(), timeliness: v.number() }),
    ),
    scoreReasons: v.array(v.string()),
    sourceItemIds: v.array(v.id("sourceItems")),
    suggestedMemberId: v.optional(v.id("members")),
    claimedBy: v.optional(v.id("members")),
    draftId: v.optional(v.id("drafts")),
    runId: v.optional(v.id("runs")),
    status: v.union(
      v.literal("new"),
      v.literal("shared"),
      v.literal("claimed"),
      v.literal("drafted"),
      v.literal("posted"),
      v.literal("dismissed"),
    ),
    weekOf: v.string(),
  })
    .index("by_workspace_week", ["workspaceId", "weekOf"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  voiceProfiles: defineTable({
    memberId: v.optional(v.id("members")),
    companyId: v.optional(v.id("workspaces")),
    about: v.optional(v.string()),
    audience: v.optional(v.string()),
    pillars: v.optional(v.array(v.string())),
    pageUrl: v.optional(v.string()),
    samplePosts: v.optional(v.array(v.string())),
    styleNotes: v.string(),
    bannedWords: v.array(v.string()),
    analyzedAt: v.optional(v.number()),
    autoUpdate: v.optional(v.boolean()),
    analyzing: v.optional(v.boolean()),
    analyzeAfter: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_member", ["memberId"])
    .index("by_company", ["companyId"]),

  voiceSamples: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.optional(v.id("members")),
    companyId: v.optional(v.id("workspaces")),
    addedBy: v.optional(v.id("members")),
    kind: voiceKind,
    origin: voiceOrigin,
    text: v.string(),
    title: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    fileName: v.optional(v.string()),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_member", ["memberId", "createdAt"])
    .index("by_company", ["companyId", "createdAt"]),

  voiceVersions: defineTable({
    memberId: v.optional(v.id("members")),
    companyId: v.optional(v.id("workspaces")),
    styleNotes: v.string(),
    sampleCount: v.number(),
    trigger: v.union(v.literal("manual"), v.literal("auto"), v.literal("edit"), v.literal("restore")),
    createdAt: v.number(),
  })
    .index("by_member", ["memberId", "createdAt"])
    .index("by_company", ["companyId", "createdAt"]),

  drafts: defineTable({
    workspaceId: v.id("workspaces"),
    ideaId: v.optional(v.id("ideas")),
    // Written for the author by the weekly scan, not claimed by hand.
    autoDrafted: v.optional(v.boolean()),
    momentId: v.optional(v.id("moments")),
    channel: v.optional(v.string()),
    memberId: v.id("members"),
    voice: v.optional(v.literal("company")),
    brief: v.optional(v.string()),
    claims: v.optional(v.array(claim)),
    claimsCheckedAt: v.optional(v.number()),
    checkingClaims: v.optional(v.boolean()),
    reviewState: v.optional(reviewState),
    review: v.optional(
      v.object({
        requestedAt: v.number(),
        reviewerId: v.optional(v.id("members")),
        decidedAt: v.optional(v.number()),
        comment: v.optional(v.string()),
      }),
    ),
    title: v.string(),
    hooks: v.array(v.string()),
    hook: v.optional(v.string()),
    body: v.string(),
    generatedBody: v.optional(v.string()),
    // Which model wrote the first draft, and the AI tells found before and after the checker's fix.
    generation: v.optional(
      v.object({
        provider: v.string(),
        modelId: v.string(),
        tellsFirst: v.number(),
        tellsFinal: v.number(),
        labels: v.array(v.string()),
        at: v.number(),
      }),
    ),
    pendingInstruction: v.optional(v.string()),
    error: v.optional(v.string()),
    version: v.optional(v.number()),
    updatedAt: v.number(),
    revisions: v.array(
      v.object({ at: v.number(), instruction: v.optional(v.string()), body: v.string() }),
    ),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("posted"),
      v.literal("failed"),
    ),
    schedule: v.optional(
      v.object({
        at: v.number(),
        mode: v.union(v.literal("publish"), v.literal("remind")),
        state: v.union(
          v.literal("scheduled"),
          v.literal("publishing"),
          v.literal("published"),
          v.literal("due"),
          v.literal("failed"),
        ),
        jobId: v.optional(v.id("_scheduled_functions")),
        error: v.optional(v.string()),
      }),
    ),
    scheduledAt: v.optional(v.number()),
    // Files to post with the draft: up to 9 images, or one PDF, or one video.
    media: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          kind: v.union(v.literal("image"), v.literal("document"), v.literal("video")),
          name: v.string(),
          contentType: v.string(),
          size: v.number(),
        }),
      ),
    ),
    // Post this draft as a repost of another LinkedIn post, with the draft as the text on top.
    repostOf: v.optional(v.object({ url: v.string(), kind: v.string(), id: v.string() })),
  })
    .index("by_member", ["memberId", "updatedAt"])
    .index("by_workspace_scheduled", ["workspaceId", "scheduledAt"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_review", ["workspaceId", "reviewState"])
    .index("by_idea", ["ideaId"]),

  posts: defineTable({
    workspaceId: v.id("workspaces"),
    draftId: v.optional(v.id("drafts")),
    memberId: v.id("members"),
    linkedinUrl: v.string(),
    postedAt: v.number(),
    impressions: v.optional(v.number()),
    reactions: v.optional(v.number()),
    comments: v.optional(v.number()),
    trackedLinkId: v.optional(v.id("trackedLinks")),
  })
    .index("by_draft", ["draftId"])
    .index("by_workspace_posted", ["workspaceId", "postedAt"])
    .index("by_member", ["memberId"]),

  trackedLinks: defineTable({
    workspaceId: v.id("workspaces"),
    slug: v.string(),
    targetUrl: v.string(),
    postId: v.optional(v.id("posts")),
    draftId: v.optional(v.id("drafts")),
    memberId: v.optional(v.id("members")),
    clicks: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_workspace", ["workspaceId"])
    .index("by_draft", ["draftId"]),

  conversions: defineTable({
    workspaceId: v.id("workspaces"),
    trackedLinkId: v.optional(v.id("trackedLinks")),
    type: conversionType,
    at: v.number(),
    // Set when the conversion came from a CRM, so a sync never counts it twice.
    externalId: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index("by_workspace_at", ["workspaceId", "at"])
    .index("by_link", ["trackedLinkId"])
    .index("by_external", ["workspaceId", "externalId"]),

  slackStates: defineTable({
    state: v.string(),
    provider: v.optional(v.union(v.literal("slack"), v.literal("github"), v.literal("linkedin"))),
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),

  linkClicks: defineTable({
    trackedLinkId: v.id("trackedLinks"),
    at: v.number(),
    referrer: v.optional(v.string()),
  }).index("by_link", ["trackedLinkId", "at"]),

  mcpServers: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    secretId: v.optional(v.id("secrets")),
    authHeader: v.optional(v.string()),
    enabled: v.boolean(),
    toolAllowlist: v.array(v.string()),
    tools: v.optional(v.array(v.object({ name: v.string(), description: v.optional(v.string()), readOnly: v.optional(v.boolean()) }))),
    pulls: v.optional(v.array(v.object({ tool: v.string(), args: v.string() }))),
    sourceId: v.optional(v.id("sources")),
    serverName: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  skills: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
    body: v.string(),
    enabled: v.boolean(),
    scopes: v.array(skillScope),
    updatedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

  recaps: defineTable({
    workspaceId: v.id("workspaces"),
    weekOf: v.string(),
    stats: v.any(),
    topPostIds: v.array(v.id("posts")),
    summary: v.string(),
    builtAt: v.optional(v.number()),
    sentToSlack: v.optional(v.boolean()),
  }).index("by_workspace_week", ["workspaceId", "weekOf"]),

  runs: defineTable({
    workspaceId: v.id("workspaces"),
    kind: v.string(),
    trigger: v.optional(v.union(v.literal("manual"), v.literal("schedule"))),
    message: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    error: v.optional(v.string()),
    tokenUsage: v.optional(v.object({ input: v.number(), output: v.number() })),
  }).index("by_workspace_kind_started", ["workspaceId", "kind", "startedAt"]),

  billingIntents: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    plan,
    token: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  aiUsage: defineTable({
    workspaceId: v.id("workspaces"),
    month: v.string(),
    calls: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }).index("by_workspace_month", ["workspaceId", "month"]),

  outboundClicks: defineTable({
    destination: v.string(),
    placement: v.string(),
    page: v.optional(v.string()),
    at: v.number(),
  }).index("by_destination", ["destination", "at"]),

  planRequests: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    plan: v.union(v.literal("pro"), v.literal("team")),
    name: v.string(),
    email: v.optional(v.string()),
    seats: v.number(),
    status: v.union(v.literal("open"), v.literal("done"), v.literal("dismissed")),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_workspace", ["workspaceId"]),


  analyticsEvents: defineTable({
    type: v.union(v.literal("pageview"), v.literal("click"), v.literal("engage")),
    at: v.number(),
    visitorId: v.string(),
    sessionId: v.string(),
    host: v.string(),
    path: v.string(),
    title: v.optional(v.string()),
    label: v.optional(v.string()),
    href: v.optional(v.string()),
    referrer: v.optional(v.string()),
    activeMs: v.optional(v.number()),
    scroll: v.optional(v.number()),
    memberId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  })
    .index("by_at", ["at"])
    .index("by_session", ["sessionId", "at"]),

  analyticsSessions: defineTable({
    sessionId: v.string(),
    visitorId: v.string(),
    startedAt: v.number(),
    lastAt: v.number(),
    entryPath: v.string(),
    exitPath: v.string(),
    pages: v.number(),
    clicks: v.number(),
    activeMs: v.number(),
    maxScroll: v.number(),
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
    inApp: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_started", ["startedAt"])
    .index("by_visitor", ["visitorId", "startedAt"])
    .index("by_workspace", ["workspaceId", "startedAt"]),

  apiKeys: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    name: v.string(),
    prefix: v.string(),
    hash: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["hash"])
    .index("by_workspace", ["workspaceId"]),

  webhooks: defineTable({
    workspaceId: v.id("workspaces"),
    url: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    events: v.array(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    lastStatus: v.optional(v.number()),
    lastAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  auditLog: defineTable({
    workspaceId: v.id("workspaces"),
    at: v.number(),
    actorType: v.union(v.literal("member"), v.literal("api"), v.literal("slack"), v.literal("system")),
    actorId: v.optional(v.string()),
    actorName: v.string(),
    action: v.string(),
    target: v.optional(v.string()),
    detail: v.optional(v.string()),
  }).index("by_workspace_at", ["workspaceId", "at"]),

  // Every step of a draft's life, from suggestion to conversion. The outcome dataset.
  draftEvents: defineTable({
    workspaceId: v.id("workspaces"),
    draftId: v.id("drafts"),
    memberId: v.id("members"),
    type: v.string(),
    at: v.number(),
    channel: v.string(),
    voice: v.string(),
    role: v.optional(v.string()),
    momentKind: v.optional(v.string()),
    hookIndex: v.optional(v.number()),
    weekday: v.number(),
    hour: v.number(),
    via: v.string(),
    value: v.optional(v.number()),
  })
    .index("by_workspace_at", ["workspaceId", "at"])
    .index("by_draft", ["draftId", "at"]),

  distributionAudits: defineTable({
    workspaceId: v.id("workspaces"),
    token: v.string(),
    createdBy: v.id("members"),
    createdAt: v.number(),
    status: v.union(v.literal("running"), v.literal("ready"), v.literal("failed")),
    stories: v.array(
      v.object({
        title: v.string(),
        why: v.string(),
        person: v.string(),
        kind: v.string(),
        score: v.number(),
        quote: v.optional(v.string()),
        sourceTitle: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        momentId: v.optional(v.id("moments")),
      }),
    ),
    sources: v.array(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  crmConnections: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("hubspot"), v.literal("attio")),
    ciphertext: v.string(),
    iv: v.string(),
    last4: v.string(),
    // Attio: the attribute slug that holds the UTM content. HubSpot uses its own analytics fields.
    attribute: v.optional(v.string()),
    createdAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    imported: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

  slackDrafts: defineTable({
    draftId: v.id("drafts"),
    teamId: v.string(),
    channelId: v.string(),
    ts: v.string(),
  })
    .index("by_draft", ["draftId"])
    .index("by_thread", ["teamId", "channelId", "ts"]),

});
