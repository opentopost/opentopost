import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { PAGES, pageMetadata, SITE } from "@/lib/site";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell, REPO_URL } from "@/components/marketing/shell";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = pageMetadata("security");

const SECTIONS = [
  {
    title: "Model keys and tokens",
    items: [
      "A Convex action checks each key with its provider before it saves it.",
      "Keys and tokens are encrypted with AES-256-GCM. Each one gets its own random IV.",
      "The master key is an environment value on the Convex deployment. It is never in the code or the database.",
      "No query returns a key. The app shows the provider name and the last four characters only.",
      "Keys are decrypted only inside server actions, at the moment of a model call.",
    ],
  },
  {
    title: "Access",
    items: [
      "Kinde handles sign-in. Every Convex function checks the signed-in user before it reads or writes.",
      "Every function checks workspace membership. No function trusts a workspace ID from the browser.",
      "There are four roles. Owners manage billing and can delete the workspace. Admins manage settings, keys, and connections. Reviewers approve drafts. Members write their own drafts.",
      "Only owners and admins can add model keys, change the company voice, and connect Slack, GitHub, MCP servers, or a CRM.",
      "Company page posts always need an approved review before they can be posted or scheduled.",
      "Kinde provides SAML SSO, SCIM user provisioning, MFA, and passkeys. Settings > Security shows how to turn them on.",
    ],
  },
  {
    title: "API keys, agents, and webhooks",
    items: [
      "API keys are shown once and stored only as a SHA-256 hash. Each key has a scope: read, draft, publish, or admin.",
      "An agent acts as the member who made its key. It gets the same access checks and review rules as that member in the app.",
      "Webhooks only go to https addresses. On the hosted version, private and local addresses are refused.",
      "Each webhook is signed with HMAC-SHA256 in the X-Opentopost-Signature header, with a timestamp to stop replays. The signing secret is encrypted.",
      "HubSpot and Attio tokens are checked with each service, then encrypted. The sync only reads contacts.",
    ],
  },
  {
    title: "Audit log and retention",
    items: [
      "Every draft, review, schedule, post, key, webhook, role, and setting change is logged with who did it and whether it came from the app, the API, Slack, or the system.",
      "Owners and admins can read the audit log in Settings > Security.",
      "Owners and admins can set how many days source text is kept. A daily job removes older text.",
      "Deleting a workspace removes all of its data, including keys, webhooks, and the audit log.",
    ],
  },
  {
    title: "Connections",
    items: [
      "GitHub uses a GitHub App you install on the repositories you choose. It reads pull requests and releases, never code. opentopost checks that the person connecting can see the installation.",
      "LinkedIn uses each person's own sign-in with permission to post only. It cannot read messages or contacts. Tokens are encrypted and expire after 60 days.",
      "MCP servers can only run tools that read, with inputs an owner sets. The model never calls tools. On the hosted version, private and local addresses are refused.",
      "Slack reads only the channels an owner chooses, and every request from Slack is checked with Slack's signing secret.",
      "Linear, Jira, Notion, Google Docs, RSS, Intercom, and Zendesk connections only read. Keys are checked with each service, then encrypted. Intercom and Zendesk text has customer names, emails, and phone numbers removed before it is saved.",
    ],
  },
  {
    title: "What opentopost stores",
    items: [
      "Text from the sources you connect, so it can find ideas in it.",
      "Ideas, drafts, the posts you mark as published, and link clicks.",
      "Your voice samples (text, recordings, images, and links) and voice notes, so drafts sound like you. You can delete any sample at any time.",
    ],
  },
  {
    title: "What it never does",
    items: [
      "It never posts to LinkedIn unless you connect your own profile. Posts publish only when you schedule them, or when an admin turns on autopilot and the draft has a source for every claim.",
      "It never sends your data to a model provider you did not choose.",
      "It never lets content from a source or MCP server change its instructions or call a write tool.",
    ],
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Security", item: `${SITE.url}${PAGES.security.path}` },
      ],
    }
  ],
};

export default function Security() {
  return (
    <MarketingShell>
      <JsonLd data={STRUCTURED_DATA} />
      <Container>
        <PageHero
          eyebrow="Security"
          title="What we store, and how"
          body="opentopost reads private work, so this page states plainly what it keeps and how it protects it. The code is open, so you can check every line."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-4 rounded-card border border-line p-6 md:p-8">
              <h2 className="text-[20px] tracking-[-0.01em]">{section.title}</h2>
              <ul className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-body">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-card border border-line p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <Eyebrow>Report an issue</Eyebrow>
            <p className="mt-2 text-lead text-body">Found a security problem? Open a private security advisory on GitHub.</p>
          </div>
          <a
            href={`${REPO_URL}/security/advisories/new`}
            target="_blank"
            rel="noreferrer"
            className="text-[14px] font-medium underline decoration-accent underline-offset-4"
          >
            Open an advisory
          </a>
        </div>
      </Container>
      <FinalCta title="Read the code, then start" body="Use the hosted version, or run your own copy." />
    </MarketingShell>
  );
}
