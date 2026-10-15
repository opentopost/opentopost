import { HOSTED } from "../../convex/lib/limits";
import { AI_CALLS, PLAN_LIMITS, TEAM_INCLUDED_SEATS } from "../../convex/lib/planLimits";

export type PlanId = "free" | "pro" | "team" | "enterprise";

export type PlanInfo = {
  id: PlanId;
  name: string;
  who: string;
  price: string;
  period: string;
  yearly?: string;
  tone: string;
  features: string[];
};

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    who: "Try it with your own model key",
    price: "$0",
    period: "forever",
    tone: "bg-fill",
    features: [
      "Bring your own key: Gemini, Claude, OpenAI, or OpenRouter",
      `${HOSTED.membersPerWorkspace} members in one workspace`,
      `${HOSTED.sources} sources and ${HOSTED.mcpServers} MCP server`,
      "A scheduled scan every week",
      `${HOSTED.manualScansPerDay} manual scan a day`,
      "Voice profiles from posts, recordings, and screenshots",
      "Claims checked against your sources",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    who: "For one person. We provide the models.",
    price: "$19",
    period: "a month",
    yearly: "$15 a month billed yearly",
    tone: "bg-accent-soft",
    features: [
      "Claude models included, with newer ones added as they come out",
      `${AI_CALLS.pro.toLocaleString("en-US")} AI runs a month included`,
      "No API key needed. You can still use your own",
      "A scan every day",
      `${PLAN_LIMITS.pro.manualScansPerDay} manual scans a day`,
      `${PLAN_LIMITS.pro.sources} sources and ${PLAN_LIMITS.pro.mcpServers} MCP servers`,
      "Everything in Free",
    ],
  },
  {
    id: "team",
    name: "Team",
    who: "For teams that post together",
    price: "$15",
    period: `per member a month, ${TEAM_INCLUDED_SEATS} members minimum`,
    tone: "bg-sky",
    features: [
      "Everything in Pro, for every member",
      `${AI_CALLS.teamPerSeat} AI runs per member a month included`,
      "Review before posting, with approvers",
      "Company rules for every draft",
      "Slack: ideas from your channels, claim from Slack",
      "Weekly recaps, also posted to Slack",
      "Tracked links and signup tracking",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    who: "For larger companies",
    price: "Custom",
    period: "",
    tone: "bg-butter",
    features: [
      "Everything in Team",
      "SSO with SAML and SCIM",
      "Audit logs",
      "Help running opentopost on your own infrastructure",
      "A support contact and an agreed response time",
    ],
  },
];
