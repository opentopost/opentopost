import type { ReactNode } from "react";
import { Eyebrow } from "../ui";
import { Container, MarketingShell } from "./shell";

export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: ReactNode;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <MarketingShell>
      <Container className="grid gap-12 pt-16 pb-8 md:grid-cols-[220px_minmax(0,1fr)] md:pt-20">
        <aside className="md:sticky md:top-24 md:self-start">
          <nav aria-label="On this page" className="flex flex-col gap-1.5 max-md:hidden">
            <p className="mb-1 text-[12px] text-muted">On this page</p>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="text-[13px] text-body hover:text-accent">
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
        <article className="flex max-w-[680px] flex-col gap-10">
          <header className="flex flex-col gap-4">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="text-[40px] leading-[1.12] tracking-[-0.03em]">{title}</h1>
            <p className="text-[14px] text-muted">Last updated {updated}</p>
            <div className="text-lead text-body">{intro}</div>
          </header>
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-3">
              <h2 className="text-[22px] tracking-[-0.01em]">{section.title}</h2>
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-body [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                {section.body}
              </div>
            </section>
          ))}
        </article>
      </Container>
    </MarketingShell>
  );
}

export function Contact({ email, repo }: { email: string | null; repo: string }) {
  return email ? (
    <a href={`mailto:${email}`} className="underline decoration-accent underline-offset-4">
      {email}
    </a>
  ) : (
    <a href={`${repo}/issues`} className="underline decoration-accent underline-offset-4">
      the GitHub repository
    </a>
  );
}
