"use client";

import { PageHeader } from "@/components/ui";
import { VoiceStudio } from "@/components/voice-studio";

export default function VoicePage() {
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Your voice"
        description="Drafts sound like you when opentopost can study how you write and how you talk."
      />
      <VoiceStudio />
    </div>
  );
}
