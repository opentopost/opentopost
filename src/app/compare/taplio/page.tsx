import type { Metadata } from "next";
import { ComparePage } from "@/components/marketing/compare-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("compareTaplio");

export default function CompareTaplio() {
  return (
    <ComparePage
      page="compareTaplio"
      rival="Taplio"
      intro="Taplio helps one person write, schedule, and grow on LinkedIn. opentopost finds the stories in a whole team's work, writes a post for the person who did it, and shows which posts brought signups."
      rows={[
        { label: "Built for", cells: ["A startup team and its company page", "One creator or founder"] },
        { label: "Where ideas come from", cells: ["Your team's GitHub, Slack, Linear, Notion, and 7 more", "Viral posts, trends, and your own prompts"] },
        { label: "Claims linked to a source", cells: [true, false] },
        { label: "Voice for each person on a team", cells: [true, "Per account"] },
        { label: "Review before posting", cells: ["Reviewer role, required for company posts", "Team collaboration on Growth and Pro"] },
        { label: "Scheduling", cells: [true, true] },
        { label: "Signups and demos by post", note: "From your own site or CRM", cells: ["HubSpot, Attio, or API", false] },
        { label: "MCP server, REST API, webhooks", cells: [true, "Not listed"] },
        { label: "Open source and self-hosted", cells: [true, false] },
        { label: "Price", cells: ["Free with your own key. Team $15 per member a month", "$39 to $199 a month"] },
      ]}
      pickThem={["You post as one person and want to grow your own audience", "You want lead outreach and engagement tools inside LinkedIn", "You want ideas from what is trending on LinkedIn"]}
      pickUs={[
        "You want engineers, designers, and support to post about work they really did",
        "You need every claim checked against a source and reviewed before it goes out",
        "You want to know which posts brought signups, not only likes",
        "You want your agents to run the flow, or to host it yourself",
      ]}
      checked="14 October 2026"
      sources={[{ label: "Taplio's pricing page", href: "https://taplio.com/blog/taplio-pricing" }]}
    />
  );
}
