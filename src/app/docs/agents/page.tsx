import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { PageHero, StepList } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell } from "@/components/marketing/shell";
import { buttonClass, Eyebrow } from "@/components/ui";
import { PAGES, pageMetadata, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata("agents");

const code = (text: string) => <code className="rounded-[4px] bg-fill px-1.5 py-0.5 font-mono text-[13px] text-ink">{text}</code>;

function Block({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-item border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-6 border-t border-line py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16">
      <div className="flex flex-col gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-[26px] leading-[1.2] tracking-[-0.02em]">{title}</h2>
      </div>
      <div className="flex min-w-0 flex-col gap-5 text-[15px] leading-relaxed text-body">{children}</div>
    </section>
  );
}

const TOOLS: { name: string; scope: string; does: string }[] = [
  { name: "whoami", scope: "read", does: "The workspace, the member the key acts as, their role, and the key's scopes." },
  { name: "list_ideas", scope: "read", does: "Post ideas, highest score first, with who each idea suits and its source facts." },
  { name: "list_moments", scope: "read", does: "Things the team did, each with the quotes that prove it." },
  { name: "list_drafts", scope: "read", does: "The member's drafts, newest first, with status and schedule." },
  { name: "get_draft", scope: "read", does: "One draft with hooks, body, claims and their sources, review state, and schedule." },
  { name: "get_recap", scope: "read", does: "The latest weekly recap: posts, clicks, signups, and top posts." },
  { name: "claim_idea", scope: "draft", does: "Claims an idea and starts a draft in the member's voice." },
  { name: "draft_from_moment", scope: "draft", does: "Starts a draft from one moment, for any channel." },
  { name: "draft_from_brief", scope: "draft", does: "Starts a draft from your own description of what happened." },
  { name: "revise_draft", scope: "draft", does: "Rewrites a draft with one change, keeping the voice and the facts." },
  { name: "edit_draft", scope: "draft", does: "Replaces the hook, the body, or both with your own text." },
  { name: "add_voice_sample", scope: "draft", does: "Adds writing by the member so drafts sound more like them." },
  { name: "request_review", scope: "draft", does: "Sends a ready draft to the workspace's reviewers." },
  { name: "review_draft", scope: "publish", does: "Approves a draft, or returns it with a comment." },
  { name: "schedule_draft", scope: "publish", does: "Puts a draft on the calendar. Publishes or sends a reminder." },
  { name: "cancel_schedule", scope: "publish", does: "Removes a draft from the calendar." },
  { name: "mark_posted", scope: "publish", does: "Records the link to the live post, so clicks and signups count toward it." },
  { name: "start_scan", scope: "admin", does: "Scans the connected sources for new moments and ideas." },
];

const EVENTS = [
  ["idea.created", "A scan found new ideas."],
  ["draft.ready", "A draft finished writing."],
  ["draft.approved", "A reviewer approved a draft."],
  ["draft.scheduled", "A draft was put on the calendar."],
  ["post.published", "A post went live, or someone recorded its link."],
  ["conversion.created", "A signup, demo, or other conversion was recorded from a tracked link."],
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
        { "@type": "ListItem", position: 2, name: PAGES.agents.title, item: `${SITE.url}${PAGES.agents.path}` },
      ],
    },
    {
      "@type": "TechArticle",
      headline: PAGES.agents.heading,
      description: PAGES.agents.description,
      url: `${SITE.url}${PAGES.agents.path}`,
      author: { "@type": "Person", name: SITE.creator.name, url: SITE.creator.url },
    },
  ],
};

export default function AgentsDocs() {
  return (
    <MarketingShell>
      <JsonLd data={STRUCTURED_DATA} />
      <Container>
        <PageHero
          eyebrow="Docs"
          title="Run opentopost from an agent"
          body="Every step in opentopost works from an agent: find ideas, write and revise drafts, ask for review, schedule, and report results. Agents get the same access checks, review rules, and audit log as people in the app."
        >
          <div className="flex flex-wrap gap-2">
            <a href="#quick-start" className={buttonClass("primary", "md")}>
              Quick start
            </a>
            <a href="#tools" className={buttonClass("secondary", "md")}>
              See the 18 tools
            </a>
          </div>
        </PageHero>

        <Section id="quick-start" eyebrow="Quick start" title="Connect an agent in two minutes">
          <StepList
            steps={[
              { title: "Make an API key", body: <>Open Settings &gt; API and agents. Choose a name and the scopes the agent needs. Copy the key. It starts with {code("otp_")} and is shown once.</> },
              { title: "Add the MCP server", body: <>Point any MCP client at {code(`${SITE.url}/mcp`)} and send the key as a Bearer token.</> },
              { title: "Ask for something", body: <>For example: &quot;List this week&apos;s ideas and draft the best one for me.&quot;</> },
            ]}
          />
        </Section>

        <Section id="mcp" eyebrow="MCP" title="MCP server">
          <p>
            opentopost runs a remote MCP server over Streamable HTTP at {code(`${SITE.url}/mcp`)}. It answers {code("initialize")}, {code("tools/list")}, and {code("tools/call")} with JSON. Use it with Claude Code, Claude Desktop, Cursor, or any client that supports remote servers.
          </p>
          <p>Claude Code:</p>
          <Block>{`claude mcp add --transport http opentopost ${SITE.url}/mcp \\
  --header "Authorization: Bearer otp_..."`}</Block>
          <p>Cursor and other clients that read an {code("mcp.json")} file:</p>
          <Block>{`{
  "mcpServers": {
    "opentopost": {
      "url": "${SITE.url}/mcp",
      "headers": { "Authorization": "Bearer otp_..." }
    }
  }
}`}</Block>
        </Section>

        <Section id="rest" eyebrow="REST" title="REST API">
          <p>
            Each tool is also one endpoint. Send a {code("POST")} to {code(`${SITE.url}/api/v1/<tool>`)} with the tool&apos;s input as a JSON body. A {code("GET")} to {code(`${SITE.url}/api/v1`)} lists every tool with its scope and input schema.
          </p>
          <Block>{`curl -X POST ${SITE.url}/api/v1/list_ideas \\
  -H "Authorization: Bearer otp_..." \\
  -H "Content-Type: application/json" \\
  -d '{"limit": 5}'`}</Block>
          <p>
            A good call returns {code('{ "data": ... }')}. An error returns {code('{ "error": "..." }')} with status 400 for a bad input, a missing scope, or a rule that stopped the action, 401 for a missing or revoked key, and 404 for an unknown tool.
          </p>
          <p>
            Drafts take about 20 seconds to write. Tools that start a draft return its {code("draftId")} at once. Call {code("get_draft")} until {code("status")} is {code("ready")}, or listen for the {code("draft.ready")} webhook.
          </p>
        </Section>

        <Section id="keys" eyebrow="Keys" title="API keys and scopes">
          <p>A key acts as the member who made it. It can only do what that member can do in the app, and only inside the scopes it has.</p>
          <ul className="flex flex-col gap-2">
            {[
              ["read", "Read ideas, moments, drafts, and recaps."],
              ["draft", "Claim ideas, write and revise drafts, and add voice samples."],
              ["publish", "Approve, schedule, and publish posts."],
              ["admin", "Start scans and manage sources. Owners and admins only."],
            ].map(([scope, text]) => (
              <li key={scope} className="flex gap-3">
                <span className="w-20 shrink-0">{code(scope)}</span>
                {text}
              </li>
            ))}
          </ul>
          <p>
            opentopost stores only a SHA-256 hash of each key. Every call is written to the audit log with the key&apos;s name. Revoke a key in Settings &gt; API and agents, and it stops working at once.
          </p>
        </Section>

        <Section id="tools" eyebrow="Tools" title="The 18 tools">
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-3 font-medium text-ink">Tool</th>
                  <th scope="col" className="p-3 font-medium text-ink">Scope</th>
                  <th scope="col" className="p-3 font-medium text-ink">What it does</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((tool) => (
                  <tr key={tool.name} className="border-b border-line last:border-b-0">
                    <td className="p-3 font-mono text-[13px] text-ink">{tool.name}</td>
                    <td className="p-3 text-muted">{tool.scope}</td>
                    <td className="p-3">{tool.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Drafting tools take an optional {code("channel")}: {code("linkedin")}, {code("x")}, {code("changelog")}, {code("investor_update")}, or {code("newsletter")}. The default is {code("linkedin")}.
          </p>
        </Section>

        <Section id="webhooks" eyebrow="Webhooks" title="Webhooks">
          <p>Add an https endpoint in Settings &gt; API and agents and choose the events to send. Each delivery is a {code("POST")} with a JSON body:</p>
          <Block>{`{
  "event": "draft.ready",
  "workspaceId": "...",
  "at": "2026-10-14T09:00:00.000Z",
  "data": { "draftId": "...", "title": "...", "channel": "linkedin" }
}`}</Block>
          <ul className="flex flex-col gap-2">
            {EVENTS.map(([name, text]) => (
              <li key={name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="w-44 shrink-0">{code(name)}</span>
                {text}
              </li>
            ))}
          </ul>
          <p>
            Each request has an {code("X-Opentopost-Event")} header and an {code("X-Opentopost-Signature")} header in the form {code("t=<unix seconds>,v1=<hex>")}. The {code("v1")} value is the HMAC-SHA256 of {code("<t>.<raw body>")} with your signing secret. Check it, and refuse requests where {code("t")} is more than five minutes old.
          </p>
          <Block>{`import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`}</Block>
          <p>If your endpoint does not return a 2xx status, opentopost tries again up to five times, with a longer wait each time.</p>
        </Section>

        <Section id="rules" eyebrow="Rules" title="What agents cannot skip">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>Review rules apply. If the workspace needs review, an agent cannot schedule or post a draft before a reviewer approves it.</li>
            <li>A member key only changes that member&apos;s own drafts. Company page drafts need an owner or admin key.</li>
            <li>Every fact in a draft still comes from a source, and claims without a source are flagged.</li>
            <li>Every action is in the audit log, marked as coming from the API.</li>
          </ul>
          <p>
            Questions or a missing tool? Open an issue on{" "}
            <Link href={`${SITE.repo}/issues`} className="underline decoration-accent decoration-dotted underline-offset-4">
              GitHub
            </Link>
            .
          </p>
        </Section>
      </Container>
      <FinalCta title="Give your agents the distribution job" body="Make a key, connect the MCP server, and ask for this week's best post." />
    </MarketingShell>
  );
}
