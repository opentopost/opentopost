export const SITE = {
  name: "opentopost",
  // The public address of the website. Canonical links, the sitemap, and social images always use it.
  url: "https://opentopost.com",
  title: "opentopost: your team's real work, posted in their own voice",
  description:
    "opentopost turns your team's work in Slack, GitHub, and notes into LinkedIn posts in each person's voice and your company's, with every claim linked to its source. Open source, free with your own model key.",
  repo: "https://github.com/opentopost/opentopost",
  creator: { name: "Shola Jegede", url: "https://sholajegede.com", x: "@wani_shola" },
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  updated: "16 October 2026",
};

export const PAGES = {
  home: {
    path: "/",
    title: SITE.title,
    description: SITE.description,
    eyebrow: "Posts from real work",
    heading: "Your team's real work, posted in their own voice",
  },
  howItWorks: {
    path: "/how-it-works",
    title: "How it works",
    description:
      "How opentopost finds post ideas in your team's work each week, drafts them in each person's voice, and shows which posts drove clicks.",
    eyebrow: "How it works",
    heading: "From real work to a published post",
  },
  selfHost: {
    path: "/self-host",
    title: "Self-host opentopost",
    description:
      "Run opentopost on your own Convex and Kinde accounts in about ten minutes. Your Slack, notes, and code stay on your own infrastructure, with no limits.",
    eyebrow: "Self-host",
    heading: "Your Slack, notes, and code stay on your own infrastructure",
  },
  pricing: {
    path: "/pricing",
    title: "Pricing",
    description:
      "opentopost is free with your own model key, and free to self-host. Pro ($19 a month) and Team ($15 per member a month) include the AI, and Team adds review, company rules, Slack, and recaps.",
    eyebrow: "Pricing",
    heading: "Free with your own key. Paid plans add your team's workflow.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy policy",
    description: "What personal data opentopost collects, why, who processes it, how long we keep it, and how to delete it.",
    eyebrow: "Privacy",
    heading: "Privacy policy",
  },
  terms: {
    path: "/terms",
    title: "Terms of service",
    description: "The terms for using the hosted version of opentopost.",
    eyebrow: "Terms",
    heading: "Terms of service",
  },
  security: {
    path: "/security",
    title: "Security",
    description:
      "How opentopost encrypts keys with AES-256-GCM, controls access with roles, SSO, and SCIM, logs every action, signs webhooks, and what it stores and never stores.",
    eyebrow: "Security",
    heading: "What we store, and how",
  },
  agents: {
    path: "/docs/agents",
    title: "Agents, MCP, and API",
    description:
      "Connect Claude, Cursor, or your own agent to opentopost over MCP or REST. Scoped API keys, 18 tools, and signed webhooks.",
    eyebrow: "Docs",
    heading: "Run opentopost from an agent",
  },
  tools: {
    path: "/tools",
    title: "Free LinkedIn tools",
    description:
      "Small, free tools for people who post on LinkedIn. They run on your device, so what you put in is never uploaded.",
    eyebrow: "Free tools",
    heading: "Free tools for people who post on LinkedIn",
  },
  postChecker: {
    path: "/tools/post-checker",
    title: "Free LinkedIn post checker",
    description:
      "Paste a LinkedIn draft and check the first line, the see more fold, the length, and the phrases that make a post sound AI-written. It runs on your device.",
    eyebrow: "Free tool",
    heading: "Check your LinkedIn post before you publish",
  },
  postPreview: {
    path: "/tools/post-preview",
    title: "Free LinkedIn post preview",
    description:
      "See your LinkedIn post on mobile and desktop, with the exact point where see more cuts it off. It runs on your device, so your draft is never uploaded.",
    eyebrow: "Free tool",
    heading: "See your LinkedIn post the way your reader will",
  },
  linkedinPhoto: {
    path: "/tools/linkedin-photo",
    title: "Free LinkedIn photo tool",
    description:
      "Crop your photo to the LinkedIn circle, fix the light, add a ring with your own tag, and preview your profile. It runs on your device, so your photo is never uploaded.",
    eyebrow: "Free tool",
    heading: "A LinkedIn photo that looks like you at your best",
  },
  compareTaplio: {
    path: "/compare/taplio",
    title: "opentopost vs Taplio",
    description:
      "Taplio helps one person grow on LinkedIn. opentopost turns a whole team's shipped work into posts with sources, review, and signup tracking.",
    eyebrow: "Compare",
    heading: "opentopost vs Taplio",
  },
  compareEveryoneSocial: {
    path: "/compare/everyonesocial",
    title: "opentopost vs EveryoneSocial",
    description:
      "EveryoneSocial asks employees to share content marketing wrote. opentopost writes original posts from the work each person did.",
    eyebrow: "Compare",
    heading: "opentopost vs EveryoneSocial",
  },
} as const;

export type PageKey = keyof typeof PAGES;

export function pageMetadata(key: PageKey) {
  const page = PAGES[key];
  const title = key === "home" ? { absolute: page.title } : page.title;
  const socialTitle = key === "home" ? page.title : `${page.title} | ${SITE.name}`;
  return {
    title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      type: "website" as const,
      url: page.path,
      siteName: SITE.name,
      title: socialTitle,
      description: page.description,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: socialTitle,
      description: page.description,
      creator: SITE.creator.x,
    },
  };
}
