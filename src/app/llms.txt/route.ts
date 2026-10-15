import { FAQ } from "@/lib/faq";
import { PAGES, SITE } from "@/lib/site";

export function GET() {
  const pages = Object.values(PAGES)
    .map((page) => `- [${page.title}](${SITE.url}${page.path === "/" ? "" : page.path}): ${page.description}`)
    .join("\n");
  const faq = FAQ.map((item) => `### ${item.q}\n\n${item.a}`).join("\n\n");
  const body = `# ${SITE.name}

> ${SITE.description}

opentopost is open source under the AGPL-3.0 license. Teams use the hosted version, or run their own copy on Convex and Kinde.

## How it works

1. opentopost reads your connected sources: GitHub, Slack, Linear, Jira, Notion, Google Docs, RSS, Intercom, Zendesk, meeting notes, and any MCP server.
2. It finds moments (launches, fixes, results, lessons), turns them into scored post ideas, and suggests who should post each one.
3. A person claims an idea and gets three hooks and a full draft in their own voice. Every claim links to the quote behind it.
4. Drafts can be for LinkedIn, X, a changelog, an investor update, or a newsletter. Reviewers approve drafts before they go out when the workspace needs review.
5. Approved LinkedIn posts on a person's own profile publish at the next posting time. Drafts also arrive in Slack by DM, with Approve, Edit, and Pass buttons.
6. Tracked links, a site snippet, and HubSpot or Attio sync show which posts brought signups and demos. A weekly recap reports the results.

## For agents

- MCP server: ${SITE.url}/mcp (Streamable HTTP, Bearer API key)
- REST API: ${SITE.url}/api/v1 lists 18 tools; POST ${SITE.url}/api/v1/<tool> runs one
- Webhooks: signed with HMAC-SHA256 in the X-Opentopost-Signature header
- Guide: ${SITE.url}/docs/agents

## Model providers

Pro and Team plans include Claude models. On the Free plan or a self-hosted copy, bring a Claude, Gemini, OpenAI, or OpenRouter key.

## Pages

${pages}
- [Source code](${SITE.repo}): GitHub repository and setup guide.

## FAQ

${faq}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
