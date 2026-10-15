"use client";

import { DraftComposer, DraftList } from "@/components/draft-list";
import { PageHeader } from "@/components/ui";

export default function DraftsPage() {
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6">
      <PageHeader title="Drafts" description="Your drafts, from claimed ideas or your own." />
      <DraftComposer />
      <DraftList />
    </div>
  );
}
