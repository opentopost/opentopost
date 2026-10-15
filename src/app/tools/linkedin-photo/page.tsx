import type { Metadata } from "next";
import { PhotoTool } from "@/components/marketing/photo-tool";
import { PageHero } from "@/components/marketing/sections";
import { Container, FinalCta, MarketingShell } from "@/components/marketing/shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("linkedinPhoto");

export default function LinkedInPhoto() {
  return (
    <MarketingShell>
      <Container>
        <PageHero
          eyebrow="Free tool"
          title="A LinkedIn photo that looks like you at your best"
          body="Crop it to the circle, fix the light, add a ring with your tag, and see it on a LinkedIn profile before you upload it. It all happens on your device, so your photo is never uploaded."
        />
        <div className="pb-24">
          <PhotoTool />
        </div>
      </Container>
      <FinalCta title="Your photo is ready. Now give your team something to post." body="opentopost turns the work your team already does into LinkedIn posts, written in each person's own voice." />
    </MarketingShell>
  );
}
