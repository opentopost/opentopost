import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const NAMES = {
  review: "Review before posting",
  rules: "Company rules",
  slack: "Slack",
  recap: "Weekly recaps",
  conversions: "Signup tracking",
} as const;

export function TeamOnly({ feature, detail }: { feature: keyof typeof NAMES; detail?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-item border border-dashed border-line bg-sky/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[13px]">
        <p className="font-medium text-ink">{NAMES[feature]} is part of the Team plan.</p>
        {detail && <p className="text-muted">{detail}</p>}
      </div>
      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-1 text-[13px] font-medium whitespace-nowrap underline decoration-accent underline-offset-4"
      >
        See plans
        <ArrowUpRight size={13} strokeWidth={1.75} />
      </Link>
    </div>
  );
}
