import { StartCta } from "@/components/marketing/cta";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Faq, PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell } from "@/components/marketing/shell";
import { buttonClass, Check, Eyebrow } from "@/components/ui";
import { PLANS } from "@/lib/pricing";
import { pageMetadata, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata("pricing");

// Until Kinde Billing is connected to Stripe, paid plans are sold by email and set up by hand.
const MANUAL_BILLING = process.env.NEXT_PUBLIC_KINDE_BILLING !== "on";

const PRICING_FAQ = [
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan costs nothing, with your own model key. Your provider bills you for the model calls, and Gemini has a free tier. Self-hosting is free too.",
  },
  {
    q: "What do Pro and Team include that Free does not?",
    a: "Pro adds daily scans and higher limits. Team is built for companies: review with approvers, company rules, Slack, weekly recaps, and signup tracking, so a whole team posts with one process. Both plans include the AI, so you need no API key, and we move you to newer models as they come out.",
  },
  {
    q: "How does Team pricing work?",
    a: "Team costs $15 per member a month, with three members minimum, so it starts at $45 a month. Each member after the third adds $15 to your next bill.",
  },
  {
    q: "Can we use our own model key on a paid plan?",
    a: "Yes. Add your own key in settings on any plan and the price stays the same. You pay for the workflow, not for the model calls, so the plan costs the same with the included AI or with your own key.",
  },
  {
    q: "What happens if we use up the included AI?",
    a: "opentopost tells you, and nothing is deleted. Add your own model key in settings to keep going, or wait until the first of the month.",
  },
  ...(MANUAL_BILLING
    ? [
        {
          q: "How do I pay?",
          a: "While we onboard our first teams, email us for Pro or Team and we send an invoice. Your plan turns on as soon as it is paid.",
        },
      ]
    : []),
  {
    q: "Can I cancel?",
    a: "Yes, at any time. Your plan stays active until the end of the period you paid for, then the workspace moves to the Free plan.",
  },
  {
    q: "What does self-hosting cost?",
    a: "The code is free. Convex, Kinde, and Vercel each have free plans that cover a small team. You pay your own model provider.",
  },
];

export default function Pricing() {
  return (
    <MarketingShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PRICING_FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Container>
        <PageHero
          eyebrow="Pricing"
          title="Free with your own key. Paid plans add your team's workflow."
          body="Start free with a Gemini, Claude, OpenAI, or OpenRouter key. Move to Team when your company needs review, rules, Slack, and recaps in one place. The AI is included, or bring your own key at the same price."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col overflow-hidden rounded-card border ${plan.id === "team" ? "border-ink" : "border-line"}`}
            >
              <div className={`flex flex-col gap-1 border-b border-line p-6 md:min-h-[124px] ${plan.tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[22px] tracking-[-0.01em]">{plan.name}</h2>
                  {plan.id === "team" && <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-[12px] font-medium text-white">Most teams</span>}
                </div>
                <p className="text-[14px] text-body">{plan.who}</p>
              </div>
              <div className="flex flex-1 flex-col gap-6 bg-surface/60 p-6">
                <div className="flex flex-col justify-end gap-1 md:min-h-[72px]">
                  <div className="flex items-end gap-2">
                    <span className="text-[44px] leading-none tracking-[-0.03em]">{plan.price}</span>
                    {plan.period && <span className="pb-1 text-[13px] text-muted">{plan.period}</span>}
                  </div>
                  {plan.yearly && <p className="text-[13px] text-muted">or {plan.yearly}</p>}
                </div>
                {plan.id === "enterprise" ? (
                  <a
                    href={SITE.contactEmail ? `mailto:${SITE.contactEmail}?subject=opentopost%20Enterprise` : "/self-host"}
                    className={buttonClass("secondary", "md", "w-full")}
                  >
                    {SITE.contactEmail ? "Contact us" : "Self-host it"}
                  </a>
                ) : plan.id !== "free" && MANUAL_BILLING && SITE.contactEmail ? (
                  <a
                    href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`opentopost ${plan.name} plan`)}&body=${encodeURIComponent(`Hi, I would like the ${plan.name} plan.\n\nCompany:\nNumber of members:\n`)}`}
                    data-track={`Email for ${plan.name} plan`}
                    className={buttonClass(plan.id === "team" ? "primary" : "dark", "md", "w-full")}
                  >
                    Email us for {plan.name}
                  </a>
                ) : (
                  <StartCta
                    postLoginRedirectURL={plan.id === "free" ? "/dashboard" : "/settings/billing"}
                    variant={plan.id === "team" ? "primary" : plan.id === "pro" ? "dark" : "secondary"}
                    className="w-full"
                  >
                    {plan.id === "free" ? "Start free" : `Start with ${plan.name}`}
                  </StartCta>
                )}
                <ul className="flex flex-col gap-3 border-t border-dashed border-line pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-[14px] text-ink">
                      <Check className="mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-4 rounded-card border border-line bg-sky/40 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <Eyebrow>Self-hosted</Eyebrow>
            <p className="text-lead text-body">
              Run opentopost on your own Convex and Kinde accounts. Every Team feature, no limits, free and open source.
            </p>
          </div>
          <Link href="/self-host" className={buttonClass("dark", "md")}>
            Deploy your own
          </Link>
        </div>
      </Container>
      <section className="pt-24">
        <Container className="flex flex-col gap-10">
          <h2 className="text-[32px] leading-[1.2] tracking-[-0.02em] md:text-title">Pricing questions</h2>
          <Faq items={PRICING_FAQ} />
        </Container>
      </section>
      <FinalCta
        title="Start free today"
        body="Create an account, add a Gemini key or choose a paid plan, and see your first ideas in a few minutes."
      />
    </MarketingShell>
  );
}
