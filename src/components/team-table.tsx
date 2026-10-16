"use client";

import { useQuery } from "convex/react";
import { Check, Minus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { timeAgo, weekLabel } from "@/lib/format";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", reviewer: "Reviewer", member: "Member" };

function Dot({ on, label }: { on: boolean | null; label: string }) {
  if (on === null)
    return (
      <span className="text-faint" title={`${label}: not set up for the workspace`}>
        –
      </span>
    );
  return on ? (
    <span title={`${label}: connected`} className="inline-flex size-5 items-center justify-center rounded-full bg-[#def3e5] text-[#1f8a4c]">
      <Check size={12} strokeWidth={2.5} />
    </span>
  ) : (
    <span title={`${label}: not connected`} className="inline-flex size-5 items-center justify-center rounded-full bg-fill text-muted">
      <Minus size={12} strokeWidth={2.5} />
    </span>
  );
}

/** One row per person: shipped and posted this week, the signups their posts brought, what waits on them, and what they have connected. */
export function TeamTable() {
  const { workspace } = useWorkspace();
  const data = useQuery(api.personal.team, { workspaceId: workspace._id });
  if (!data) return null;
  const totals = data.rows.reduce((sum, row) => ({ shipped: sum.shipped + row.shipped, posted: sum.posted + row.posted }), { shipped: 0, posted: 0 });
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-[14px] font-medium">Your team this week</p>
          <p className="text-[12px] text-muted">
            {weekLabel(data.weekOf)} · {totals.shipped} shipped · {totals.posted} posted
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-muted">
              {["Person", "Shipped", "Posted", "Signups (30 days)", "Waiting", "Voice", "LinkedIn", "Slack", "Last seen"].map((head) => (
                <th key={head} className="px-4 py-2.5 font-normal whitespace-nowrap">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.map((row) => {
              return (
                <tr key={row.memberId}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-[12px] text-muted">{ROLE[row.role] ?? row.role}</p>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{row.shipped}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {row.posted}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className={row.signups > 0 ? "font-medium text-accent" : "text-muted"}>{row.signups}</span>
                    <span className="block text-[12px] text-muted">{row.clicks} clicks</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.waiting + row.inReview === 0 ? (
                      <span className="text-muted">–</span>
                    ) : (
                      <span className="flex flex-col">
                        {row.waiting > 0 && <span>{row.waiting} to act on</span>}
                        {row.sentBack > 0 && <span className="text-[12px] text-danger">{row.sentBack} sent back</span>}
                        {row.inReview > 0 && <span className="text-[12px] text-muted">{row.inReview} in review</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Dot on={row.voice} label="Voice samples" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Dot on={row.linkedin} label="LinkedIn" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Dot on={row.slack} label="Slack" />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{row.lastActiveAt ? timeAgo(row.lastActiveAt) : "never"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">
        Shipped counts the moments with each person&apos;s name. Signups and clicks come from the tracked links in their posts.
      </p>
    </Card>
  );
}
