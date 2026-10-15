import type { Metadata } from "next";
import { ComparePage } from "@/components/marketing/compare-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("compareEveryoneSocial");

export default function CompareEveryoneSocial() {
  return (
    <ComparePage
      page="compareEveryoneSocial"
      rival="EveryoneSocial"
      intro="EveryoneSocial gives employees a library of approved content to share. opentopost writes original posts from the work each person did, in their own voice, with every claim linked to its source."
      rows={[
        { label: "Built for", cells: ["Startup teams", "Large companies with a marketing team"] },
        { label: "What people post", cells: ["Original posts about their own work", "Shares of content the company approved"] },
        { label: "Where ideas come from", cells: ["Your team's GitHub, Slack, Linear, Notion, and 7 more", "A curated content library"] },
        { label: "Drafts in each person's voice", cells: [true, "Not listed"] },
        { label: "Claims linked to a source", cells: [true, false] },
        { label: "Review before posting", cells: [true, true] },
        { label: "Slack", cells: ["Drafts by DM, approve or edit in one click", true] },
        { label: "Outcome tracking", cells: ["Signups and demos by post, with HubSpot or Attio", "Engagement and web analytics"] },
        { label: "MCP server, REST API, webhooks", cells: [true, "Not listed"] },
        { label: "Open source and self-hosted", cells: [true, false] },
        { label: "Price", cells: ["Free with your own key. Team $15 per member a month", "Ask for a quote"] },
      ]}
      pickThem={["You have a marketing team that makes content for employees to share", "You need a large content library across many teams and regions", "Gamification and leaderboards matter to your program"]}
      pickUs={[
        "You want posts that show what each person really built, not shared links",
        "You have no marketing team and need the posts written for you",
        "You want to know which posts brought signups and demos",
        "You want your agents to run the flow, or to host it yourself",
      ]}
      checked="14 October 2026"
      sources={[{ label: "EveryoneSocial on Capterra", href: "https://www.capterra.com/p/148549/EveryoneSocial/" }]}
    />
  );
}
