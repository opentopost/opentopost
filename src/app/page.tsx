import { StartCta } from "@/components/marketing/cta";
import {
  ArrowRight,
  Bot,
  ChartLine,
  ClipboardCheck,
  FileSearch,
  GitPullRequest,
  History,
  KeyRound,
  Lock,
  Lightbulb,
  MessageSquare,
  Plug,
  ScrollText,
  Server,
  ShieldCheck,
  Timer,
  Users,
  Webhook,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { IconTile } from "@/components/mark";
import { Integrations } from "@/components/marketing/integrations";
import { HeroVignette, Vignette, type VignetteName } from "@/components/marketing/vignettes";
import { Faq } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell, REPO_URL, SectionHead } from "@/components/marketing/shell";
import { buttonClass, Check, Eyebrow } from "@/components/ui";
import { FAQ } from "@/lib/faq";
import { PLANS } from "@/lib/pricing";
import { pageMetadata, SITE } from "@/lib/site";

const icon = (Icon: typeof ShieldCheck, size = 14) => <Icon size={size} strokeWidth={1.75} />;


export const metadata: Metadata = pageMetadata("home");

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/brand/logo-mark-512.png`,
      sameAs: [SITE.repo],
      founder: { "@type": "Person", name: SITE.creator.name, url: SITE.creator.url },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "19", priceCurrency: "USD" },
        { "@type": "Offer", name: "Team", price: "15", priceCurrency: "USD", description: "Per member a month, three members minimum" },
      ],
      codeRepository: SITE.repo,
      publisher: { "@id": `${SITE.url}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

const TOUR: { name: VignetteName; eyebrow: string; title: string; body: string; points: string[] }[] = [
  {
    name: "moments",
    eyebrow: "Moments",
    title: "Every post starts with something that really happened",
    body: "opentopost reads the work your team already does and pulls out moments: a launch, a fix, a customer result, a hard lesson. Each fact keeps the exact quote it came from.",
    points: ["Reads Slack, GitHub, Linear, Jira, Notion, Google Docs, and MCP servers", "Every fact quotes its source word for word", "Numbers that are not in a source are removed"],
  },
  {
    name: "draft",
    eyebrow: "Drafts",
    title: "Drafts in their voice, with sources",
    body: "Claim an idea and get three hooks and a full post, written the way that person writes. Every claim links to the quote behind it, and the post publishes to LinkedIn on schedule.",
    points: ["Learns each person's voice from their own writing", "Every claim checked against its source", "Publishes on schedule, or approve it in Slack"],
  },
  {
    name: "recap",
    eyebrow: "Recap",
    title: "Outcomes your leadership cares about",
    body: "Every Friday, a recap shows what the team posted and what it drove: link clicks, signups, demos, and job applications. Not likes.",
    points: ["Tracked links on every post", "Signups reported from your own site", "Posted to Slack every Friday"],
  },
];

const AGENT_SURFACES = [
  { i: Bot, t: "MCP server", b: "Connect Claude, Cursor, or any MCP client. 18 tools cover ideas, drafts, review, scheduling, and recaps." },
  { i: Webhook, t: "REST API and webhooks", b: "Scoped API keys, one endpoint per tool, and signed webhooks for new ideas, drafts, posts, and signups." },
  { i: MessageSquare, t: "Slack", b: "Drafts arrive by DM. Approve, edit, or pass with one click, or reply in the thread to ask for changes." },
];

const CONTROLS = [
  { i: ClipboardCheck, t: "Review before posting", b: "Reviewers approve drafts. Company posts always need an approval." },
  { i: Users, t: "Four roles", b: "Owner, admin, reviewer, and member, each with only the access it needs." },
  { i: History, t: "Audit log", b: "Every draft, review, schedule, key, and setting change is logged with who did it and from where." },
  { i: Lock, t: "SSO and SCIM", b: "Email, Google, passkeys, SAML SSO, SCIM, and MFA through Kinde." },
  { i: KeyRound, t: "Encrypted secrets", b: "Model keys, Slack, LinkedIn, and MCP tokens are encrypted with AES-256-GCM." },
  { i: Server, t: "Self-host any time", b: "The same code runs on your own Convex and Kinde accounts, with every feature and no limits." },
  { i: ScrollText, t: "Company rules", b: "Write what you never claim, name, or share. Every scan and draft follows it." },
  { i: FileSearch, t: "Traceable claims", b: "Each claim links to the quote that supports it. Unsupported numbers are flagged." },
  { i: GitPullRequest, t: "Read-only GitHub", b: "A GitHub App you install on the repositories you choose. It reads pull requests and releases only." },
  { i: Plug, t: "Safe MCP access", b: "Only tools that read are allowed. The model never calls tools, so source text cannot trigger actions." },
  { i: KeyRound, t: "Scoped API keys", b: "Keys are stored only as a SHA-256 hash, with read, draft, publish, or admin scope." },
  { i: Timer, t: "Data retention", b: "Choose how long source text is kept. Older text is removed every day." },
];

export default function Home() {
  return (
    <MarketingShell>
      <JsonLd data={STRUCTURED_DATA} />

      <section className="relative overflow-hidden pt-14 md:pt-20">
        <div className="grid-faint absolute inset-x-0 top-0 h-[560px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <Container className="relative flex flex-col items-center gap-6 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3 pl-1 text-[13px] text-body hover:bg-surface"
          >
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-ink">New</span>
            Agents, MCP, webhooks, and CRM sync
            <ArrowRight size={13} strokeWidth={1.75} />
          </Link>
          <h1 className="max-w-[920px] text-[42px] leading-[1.08] tracking-[-0.035em] md:text-[64px]">
            Your team&apos;s real work, posted in their own voice
          </h1>
          <p className="max-w-[640px] text-lead text-body">
            opentopost turns what your team ships into posts from the person who did the work, and shows which posts brought signups.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <StartCta postLoginRedirectURL="/insights?audit=1" size="lg">
              Get your free distribution audit
            </StartCta>
            <StartCta size="lg" variant="secondary" demoHidden>
              Start free
            </StartCta>
          </div>
        </Container>
        <Container className="relative mt-14">
          <HeroVignette />
        </Container>
      </section>


      <section className="pt-16">
        <Container>
          <Integrations />
        </Container>
      </section>

      <section className="py-24 md:py-28">
        <Container className="flex flex-col gap-10">
          <SectionHead
            eyebrow="Why teams use it"
            title="Your people do the work. Almost none of it gets posted."
            body="Engineers, designers, and support teams solve real problems every week. A post from the person who did the work earns more trust than any ad. opentopost removes what stops them: the idea, the writing, the proof, and the habit."
          />
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
            {[
              { i: Lightbulb, t: "No blank page", b: "Ideas come from this week's real work, scored and matched to the person closest to it." },
              { i: ShieldCheck, t: "No slop", b: "Drafts use only facts from your sources, in a voice learned from each person." },
              { i: ChartLine, t: "No guessing", b: "Tracked links and signups show which posts moved the business." },
            ].map((item) => (
              <div key={item.t} className="flex flex-col gap-3 bg-canvas p-6 md:p-8">
                <IconTile tone="accent" size={32}>
                  {icon(item.i)}
                </IconTile>
                <h3 className="text-[20px] tracking-[-0.01em]">{item.t}</h3>
                <p className="text-[14px] leading-relaxed text-body">{item.b}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-24 md:pb-28">
        <Container className="flex flex-col gap-24">
          {TOUR.map((step, index) => (
            <div key={step.name} className={`grid grid-cols-1 items-center gap-10 ${index % 2 ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"}`}>
              <div className={`flex min-w-0 flex-col gap-5 ${index % 2 ? "lg:order-2" : ""}`}>
                <Eyebrow>{step.eyebrow}</Eyebrow>
                <h2 className="text-[30px] leading-[1.15] tracking-[-0.02em] md:text-[36px]">{step.title}</h2>
                <p className="text-lead text-body">{step.body}</p>
                <ul className="flex flex-col gap-2.5">
                  {step.points.map((point) => (
                    <li key={point} className="flex gap-3 text-[15px] text-ink">
                      <Check className="mt-1 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`min-w-0 ${index % 2 ? "lg:order-1" : ""}`}>
                <Vignette name={step.name} />
              </div>
            </div>
          ))}
        </Container>
      </section>

      <section className="pb-24 md:pb-28">
        <Container className="flex flex-col gap-10">
          <SectionHead
            eyebrow="Agent ready"
            title="Every step works from an agent, an API call, or Slack"
            body="Your agents can find ideas, write drafts, ask for review, schedule, and report outcomes with the same rules and audit log as the app."
            tone="sky"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {AGENT_SURFACES.map((item) => (
              <div key={item.t} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
                <IconTile tone="sky" size={32}>
                  {icon(item.i)}
                </IconTile>
                <h3 className="text-[18px] font-medium">{item.t}</h3>
                <p className="text-[14px] leading-relaxed text-body">{item.b}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs/agents" className={buttonClass("secondary", "md")}>
              Read the agent guide
            </Link>
          </div>
        </Container>
      </section>

      <section className="pb-24 md:pb-28">
        <Container className="flex flex-col gap-10">
          <SectionHead
            eyebrow="Built for companies"
            title="Controls your legal, security, and brand teams will ask for"
            body="opentopost reads private work, so it is built to keep that work safe and every public word accountable."
            tone="sky"
          />
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.slice(0, 6).map((item) => (
              <div key={item.t} className="flex flex-col gap-3 bg-canvas p-6">
                <span className="inline-flex size-8 items-center justify-center rounded-control border border-line bg-surface text-ink">{icon(item.i)}</span>
                <h3 className="text-[16px] font-medium">{item.t}</h3>
                <p className="text-[14px] leading-relaxed text-body">{item.b}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/security" className={buttonClass("secondary", "md")}>
              Read the security overview
            </Link>
            <Link href="/self-host" className={buttonClass("ghost", "md")}>
              Self-host it
            </Link>
          </div>
        </Container>
      </section>

      <section className="pb-24 md:pb-28">
        <Container className="flex flex-col gap-10">
          <SectionHead
            eyebrow="Pricing"
            title="Start free. Pay when you want us to run the models."
            body="Every plan includes moments, drafts in your voice, claim checks, and the calendar. Team adds review, rules, Slack, recaps, and signup tracking."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Link
                key={plan.id}
                href="/pricing"
                className={`flex flex-col gap-3 rounded-card border p-6 transition-colors hover:bg-surface ${plan.id === "team" ? "border-ink" : "border-line"}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-medium">{plan.name}</h3>
                  {plan.id === "team" && <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-[11px] font-medium text-white">Most teams</span>}
                </div>
                <p>
                  <span className="text-[32px] tracking-[-0.03em]">{plan.price}</span>{" "}
                  <span className="text-[13px] text-muted">{plan.period}</span>
                </p>
                <p className="text-[14px] text-body">{plan.who}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-8">
        <Container className="flex flex-col gap-10">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <h2 className="text-[32px] leading-[1.2] tracking-[-0.02em] md:text-title">Questions</h2>
            <p className="text-lead text-body">
              More questions? Open an issue on{" "}
              <a href={`${REPO_URL}/issues`} className="underline decoration-accent decoration-dotted underline-offset-4">
                GitHub
              </a>
              {SITE.contactEmail ? (
                <>
                  {" "}or email{" "}
                  <a href={`mailto:${SITE.contactEmail}`} className="underline decoration-accent decoration-dotted underline-offset-4">
                    {SITE.contactEmail}
                  </a>
                </>
              ) : null}
              .
            </p>
          </div>
          <Faq items={FAQ.slice(0, 6)} />
        </Container>
      </section>

      <FinalCta
        title="Your team already did the work"
        body="Connect one source and get your distribution audit in a few minutes. Free with your own model key."
      />
    </MarketingShell>
  );
}
