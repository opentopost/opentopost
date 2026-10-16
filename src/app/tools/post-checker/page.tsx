import type { Metadata } from "next";
import { PostChecker } from "@/components/marketing/post-tools";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell } from "@/components/marketing/shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("postChecker");

export default function PostCheckerPage() {
  return (
    <MarketingShell>
      <Container>
        <PageHero
          eyebrow="Free tool"
          title="Check your LinkedIn post before you publish"
          body="Paste a draft and see how the first line reads, where the see more fold falls, how long it is, and which phrases make it sound machine-written. It all runs on your device, so your draft is never uploaded."
        />
        <PostChecker />
      </Container>
      <FinalCta title="A clean draft is a good start. Now make every post sound like its author." body="opentopost writes each post in the author's own voice and runs this check on every draft." />
    </MarketingShell>
  );
}
