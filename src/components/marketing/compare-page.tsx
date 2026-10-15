import { StartCta } from "@/components/marketing/cta";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { CompareTable, PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell, SectionHead } from "@/components/marketing/shell";
import { buttonClass, Check } from "@/components/ui";
import { PAGES, SITE, type PageKey } from "@/lib/site";

type Cell = boolean | string;

export function ComparePage({
  page,
  rival,
  intro,
  rows,
  pickThem,
  pickUs,
  checked,
  sources,
}: {
  page: PageKey;
  rival: string;
  intro: string;
  rows: { label: string; note?: string; cells: [Cell, Cell] }[];
  pickThem: string[];
  pickUs: string[];
  checked: string;
  sources: { label: string; href: string }[];
}) {
  const meta = PAGES[page];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
      { "@type": "ListItem", position: 2, name: meta.title, item: `${SITE.url}${meta.path}` },
    ],
  };
  return (
    <MarketingShell>
      <JsonLd data={data} />
      <Container>
        <PageHero eyebrow="Compare" title={meta.heading} body={intro}>
          <div className="flex flex-wrap gap-2">
            <StartCta postLoginRedirectURL="/insights?audit=1">Get your free distribution audit</StartCta>
            <Link href="/how-it-works" className={buttonClass("secondary", "md")}>
              How it works
            </Link>
          </div>
        </PageHero>
      </Container>

      <section className="pb-20">
        <Container className="flex flex-col gap-6">
          <CompareTable corner="Side by side" highlight={0} columns={[{ title: SITE.name }, { title: rival }]} rows={rows} />
          <p className="text-[13px] text-muted">
            {rival} details checked on {checked} from{" "}
            {sources.map((source, index) => (
              <span key={source.href}>
                {index > 0 && ", "}
                <a href={source.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4">
                  {source.label}
                </a>
              </span>
            ))}
            . Products change, so check their site for the latest.
          </p>
        </Container>
      </section>

      <section className="pb-20">
        <Container className="flex flex-col gap-10">
          <SectionHead eyebrow="Which one" title="Pick the one that fits the job" body="They solve different problems. Some teams use both." />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: `Pick ${rival} if`, points: pickThem, tone: "bg-surface" },
              { title: `Pick ${SITE.name} if`, points: pickUs, tone: "bg-accent-soft/40" },
            ].map((card) => (
              <div key={card.title} className={`flex flex-col gap-4 rounded-card border border-line p-6 md:p-8 ${card.tone}`}>
                <h3 className="text-[22px] tracking-[-0.02em]">{card.title}</h3>
                <ul className="flex flex-col gap-2.5">
                  {card.points.map((point) => (
                    <li key={point} className="flex gap-3 text-[15px] text-ink">
                      <Check className="mt-1 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta title="See what your team has not posted yet" body="Connect one source and get your distribution audit in a few minutes. Free with your own model key." />
    </MarketingShell>
  );
}
