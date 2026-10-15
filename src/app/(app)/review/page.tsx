"use client";

import { isReviewer } from "@/lib/roles";
import { useQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";

export default function ReviewPage() {
  const { workspace, member } = useWorkspace();
  const queue = useQuery(api.drafts.reviewQueue, { workspaceId: workspace._id });

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Review"
        description={
          workspace.reviewRequired
            ? "Drafts in this workspace need an owner's approval before anyone posts them."
            : "Drafts people sent for review. Owners can make review required in settings."
        }
      />
      {!isReviewer(member.role) ? (
        <p className="text-muted">Owners review drafts. Ask for review from any draft.</p>
      ) : queue === undefined ? (
        <SkeletonList label="Loading drafts" />
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={20} strokeWidth={1.75} />}
          title="Nothing to review"
          body="When someone asks for review, their draft shows up here with its claims checked."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {queue.map((row) => (
              <li key={row._id} className="border-t border-line first:border-t-0">
                <Link href={`/drafts/${row._id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-fill/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{row.title}</p>
                    <p className="truncate text-[13px] text-muted">
                      {row.isMine ? "You" : row.authorName}, {timeAgo(row.requestedAt)}: {row.hook}
                    </p>
                  </div>
                  {row.checking ? (
                    <Badge tone="fill">Checking claims</Badge>
                  ) : row.unsupported > 0 ? (
                    <Badge tone="danger">{row.unsupported} {row.unsupported === 1 ? "needs" : "need"} a source</Badge>
                  ) : (
                    <Badge>All sourced</Badge>
                  )}
                  <span className={buttonClass("secondary")}>Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
