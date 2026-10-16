import type { Metadata } from "next";
import { PostPreview } from "@/components/marketing/post-tools";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell } from "@/components/marketing/shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("postPreview");

export default function PostPreviewPage() {
  return (
    <MarketingShell>
      <Container>
        <PageHero
          eyebrow="Free tool"
          title="See your LinkedIn post the way your reader will"
          body="Paste a post, add your name and photo, and see it on mobile and desktop, with the exact spot where see more cuts it off. It all runs on your device."
        />
        <PostPreview />
      </Container>
      <FinalCta title="You saw the first lines. Now give your whole team something to post." body="opentopost turns the work your team already does into LinkedIn posts, written in each person's own voice." />
    </MarketingShell>
  );
}
