import {
  Bell,
  BookOpen,
  Cpu,
  FileText,
  GitPullRequest,
  Hash,
  KeyRound,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  Plug,
  Send,
  SquareKanban,
} from "lucide-react";
import type { ReactNode } from "react";

type Item = { name: string; icon: ReactNode; note?: string };

const ico = (Icon: typeof Hash) => <Icon size={13} strokeWidth={1.75} />;

const GROUPS: { label: string; title: string; items: Item[]; wide?: boolean }[] = [
  {
    label: "Reads from",
    title: "Where your team already works",
    wide: true,
    items: [
      { name: "Slack", icon: ico(Hash) },
      { name: "GitHub", icon: ico(GitPullRequest) },
      { name: "Linear", icon: ico(ListChecks) },
      { name: "Jira", icon: ico(SquareKanban) },
      { name: "Notion", icon: ico(BookOpen) },
      { name: "Google Docs", icon: ico(FileText) },
      { name: "Intercom", icon: ico(MessagesSquare) },
      { name: "Zendesk", icon: ico(LifeBuoy) },
      { name: "MCP servers", icon: ico(Plug) },
    ],
  },
  {
    label: "Sends to",
    title: "Where posts and reminders go",
    items: [
      { name: "LinkedIn", icon: ico(Send), note: "Publish" },
      { name: "Slack", icon: ico(Bell), note: "Recaps" },
    ],
  },
  {
    label: "Writes with",
    title: "The model you choose",
    items: [
      { name: "Gemini", icon: ico(Cpu) },
      { name: "Claude", icon: ico(Cpu) },
      { name: "OpenAI", icon: ico(Cpu) },
      { name: "Your own key", icon: ico(KeyRound) },
    ],
  },
];

function Chip({ item }: { item: Item }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-fill text-ink">{item.icon}</span>
      <span className="min-w-0 text-[14px] leading-tight font-medium tracking-[-0.01em] text-ink">{item.name}</span>
      {item.note && <span className="ml-auto hidden shrink-0 font-mono text-[10px] lg:inline tracking-wide text-muted uppercase">{item.note}</span>}
    </li>
  );
}

/** The tools opentopost reads from, sends to, and writes with. */
export function Integrations() {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-card border border-line bg-canvas lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {GROUPS.map((group, index) => (
        <div
          key={group.label}
          className={`flex min-w-0 flex-col gap-5 p-5 md:p-7 ${index > 0 ? "border-t border-line lg:border-t-0 lg:border-l" : ""}`}
        >
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[11px] tracking-wide text-accent-deep uppercase">{group.label}</p>
            <p className="text-[16px] text-ink">{group.title}</p>
          </div>
          <ul className={`grid gap-2 ${group.wide ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-1"}`}>
            {group.items.map((item) => (
              <Chip key={`${group.label}-${item.name}`} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
