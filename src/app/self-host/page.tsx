import { Infinity as InfinityIcon, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { PAGES, pageMetadata, SITE } from "@/lib/site";
import { IconTile } from "@/components/mark";
import { TerminalMock } from "@/components/marketing/mocks";
import { CompareTable, PageHero, StepList } from "@/components/marketing/sections";
import { Container, FinalCta, GitHubIcon, MarketingShell, REPO_URL, SectionHead } from "@/components/marketing/shell";
import { buttonClass, Eyebrow } from "@/components/ui";

export const metadata: Metadata = pageMetadata("selfHost");

const code = (text: string) => (
  <code className="rounded-[4px] bg-fill px-1.5 py-0.5 font-mono text-[13px] text-ink">{text}</code>
);

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Self-host", item: `${SITE.url}${PAGES.selfHost.path}` },
      ],
    },
    {
      "@type": "HowTo",
      name: "How to self-host opentopost",
      description: PAGES.selfHost.description,
      totalTime: "PT10M",
      step: [
        "Clone the repository and run npm install.",
        "Run npx convex dev to create a Convex project.",
        "Create a Kinde back-end web application and copy its values into .env.local.",
        "Set KINDE_ISSUER_URL, KINDE_CLIENT_ID, and SECRETS_MASTER_KEY with npx convex env set.",
        "Run npm run dev, create an account, and add a model key.",
      ].map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
    }
  ],
};

export default function SelfHost() {
  return (
    <MarketingShell>
      <JsonLd data={STRUCTURED_DATA} />
      <Container>
        <PageHero
          eyebrow="Self-host"
          title="Your Slack, notes, and code stay on your own infrastructure"
          body="opentopost is open source. Run your own copy on Convex and Kinde, and every source, idea, draft, and key stays in your own accounts."
        >
          <div className="flex flex-wrap gap-2">
            <a href={`${REPO_URL}/blob/main/docs/self-hosting.md`} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
              Read the setup guide
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
              <GitHubIcon size={14} />
              View on GitHub
            </a>
          </div>
        </PageHero>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { i: ShieldCheck, t: "Data ownership", b: "Your sources and drafts live in your own Convex database. Nobody else can read them." },
            { i: InfinityIcon, t: "No limits", b: "The hosted limits do not apply. Add every team, source, and MCP server you need." },
            { i: Lock, t: "Your own access control", b: "Kinde runs sign-in for your copy. Turn on SSO, MFA, and roles for your team." },
          ].map((item) => (
            <article key={item.t} className="flex flex-col gap-2 rounded-card border border-line p-6">
              <IconTile tone="sky" size={28}>
                <item.i size={14} strokeWidth={1.75} />
              </IconTile>
              <h2 className="mt-2 text-[18px] tracking-[-0.01em]">{item.t}</h2>
              <p className="text-[14px] leading-relaxed text-body">{item.b}</p>
            </article>
          ))}
        </div>
      </Container>

      <section className="py-24 md:py-28">
        <Container className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <Eyebrow>Setup</Eyebrow>
              <h2 className="text-[32px] leading-[1.2] tracking-[-0.02em] md:text-title">Running in about ten minutes.</h2>
            </div>
            <StepList
              steps={[
                { title: "Clone and install", body: <>Clone the repository, then run {code("npm install")}.</> },
                { title: "Create a Convex project", body: <>Run {code("npx convex dev")}. It creates the project and writes your Convex URL to {code(".env.local")}.</> },
                {
                  title: "Create a Kinde application",
                  body: <>Choose a back-end web app. Add {code("/api/auth/kinde_callback")} as the callback URL, then copy the values into {code(".env.local")}.</>,
                },
                {
                  title: "Set three Convex values",
                  body: <>Set {code("KINDE_ISSUER_URL")}, {code("KINDE_CLIENT_ID")}, and {code("SECRETS_MASTER_KEY")} with {code("npx convex env set")}.</>,
                },
                { title: "Start the app", body: <>Run {code("npm run dev")}, create an account, and add a model key.</> },
              ]}
            />
          </div>
          <div className="grid-paper grid-paper-sky flex items-center rounded-card border border-line p-6 md:p-10">
            <TerminalMock />
          </div>
        </Container>
      </section>

      <section className="pb-8">
        <Container className="flex flex-col gap-10">
          <SectionHead
            eyebrow="Compare"
            title="Hosted or self-hosted."
            body="Both run the same code. The difference is where it runs and who sets the limits."
          />
          <CompareTable
            corner="Setup"
            highlight={1}
            columns={[{ title: "Hosted" }, { title: "Self-hosted", note: "Recommended for teams" }]}
            rows={[
              { label: "Setup time", cells: ["Under 5 minutes", "About 10 minutes"] },
              { label: "Where data lives", cells: ["Our Convex deployment", "Your Convex deployment"] },
              { label: "Workspaces", cells: ["1", "Unlimited"] },
              { label: "Members", cells: ["5", "Unlimited"] },
              { label: "Scheduled scans", cells: ["Once a week", "Your choice"] },
              { label: "Sources", cells: ["2", "Unlimited"] },
              { label: "MCP servers", cells: ["1", "Unlimited"] },
              { label: "SSO, MFA, and roles", cells: [false, true] },
              { label: "Cost", cells: ["Free", "Free plans on Convex and Kinde"] },
            ]}
          />
        </Container>
      </section>

      <FinalCta title="Run your own copy today" body="The self-hosting guide in the repository has every step." />
    </MarketingShell>
  );
}
