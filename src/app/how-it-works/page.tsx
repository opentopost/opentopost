import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { PAGES, pageMetadata, SITE } from "@/lib/site";
import { Screen, type ScreenName } from "@/components/marketing/screen";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell, StartButtons } from "@/components/marketing/shell";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = pageMetadata("howItWorks");

const STEPS: { eyebrow: string; title: string; body: string; screen: ScreenName; path: string }[] = [
  {
    eyebrow: "Every day",
    title: "Moments come from your own work",
    body: "opentopost reads the last 14 days of the Slack channels, repositories, notes, and MCP servers you connect. It pulls out moments worth a post, and every fact keeps the exact quote it came from.",
    screen: "moments",
    path: "moments",
  },
  {
    eyebrow: "Scored and matched",
    title: "Ideas for the right person",
    body: "Each moment becomes a scored idea, matched to the person closest to the work. The best ideas also go to Slack with a Claim button. Anyone can turn an idea into a personal post or a company page post.",
    screen: "ideas",
    path: "ideas",
  },
  {
    eyebrow: "When you claim one",
    title: "A draft that cites its sources",
    body: "You get three hooks and a full draft in your voice, or in the company's. Every claim links to its quote. Ask for a change in one sentence, and an owner approves company posts before they go out.",
    screen: "draft",
    path: "drafts",
  },
  {
    eyebrow: "Always learning",
    title: "A voice that stays up to date",
    body: "Each person adds posts, voice notes, screenshots, and links. opentopost rebuilds their voice profile as they add more and as they edit drafts, and keeps every version.",
    screen: "voice",
    path: "voice",
  },
  {
    eyebrow: "On schedule",
    title: "Posted at the right time",
    body: "Schedule a post and it publishes to your LinkedIn on its own, or sends you a reminder. A weekly goal keeps the habit going.",
    screen: "calendar",
    path: "calendar",
  },
  {
    eyebrow: "Every Friday",
    title: "Everyone sees what it drove",
    body: "Tracked links count clicks, and your site can report signups and demos. The weekly recap shows the top posts and who posted, in the app and in Slack.",
    screen: "recap",
    path: "recap",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
        { "@type": "ListItem", position: 2, name: "How it works", item: `${SITE.url}${PAGES.howItWorks.path}` },
      ],
    }
  ],
};

export default function HowItWorks() {
  return (
    <MarketingShell>
      <JsonLd data={STRUCTURED_DATA} />
      <Container>
        <PageHero
          eyebrow="How it works"
          title="From real work to a published post"
          body="opentopost removes the four things that stop people from posting: finding an idea, writing it, proving it worked, and keeping the habit. These screens are the real app."
        >
          <StartButtons />
        </PageHero>
      </Container>
      <section className="pb-8">
        <Container className="flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex flex-col gap-6 overflow-hidden rounded-card border border-line p-4 md:gap-8 md:p-8">
              <div className="grid gap-3 px-2 md:grid-cols-2 md:gap-10 md:px-0">
                <div className="flex flex-col gap-3">
                  <Eyebrow>{`${index + 1}. ${step.eyebrow}`}</Eyebrow>
                  <h2 className="text-[28px] leading-[1.2] tracking-[-0.02em]">{step.title}</h2>
                </div>
                <p className="text-lead text-body md:self-end">{step.body}</p>
              </div>
              <div className="grid-paper rounded-[14px] p-2 md:p-6">
                <Screen name={step.screen} path={step.path} priority={index === 0} />
              </div>
            </div>
          ))}
        </Container>
      </section>
      <FinalCta title="See this week's ideas" body="Connect one source. Your first ideas show up in a few minutes." />
    </MarketingShell>
  );
}
