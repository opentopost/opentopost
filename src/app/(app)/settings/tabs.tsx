"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/workspace";
import { isManager } from "@/lib/roles";

// Members see only their own settings. Owners and admins see the workspace settings too.
const TABS = [
  { href: "/settings/general", label: "General", manager: true },
  { href: "/settings/members", label: "Members", manager: true },
  { href: "/settings/rules", label: "Rules", manager: true },
  { href: "/settings/model", label: "Model", manager: true },
  { href: "/settings/publishing", label: "Publishing", manager: false },
  { href: "/settings/api", label: "API and agents", manager: false },
  { href: "/settings/pipeline", label: "Pipeline", manager: true },
  { href: "/settings/security", label: "Security", manager: true },
  { href: "/settings/billing", label: "Billing", manager: true },
  { href: "/settings/account", label: "Account", manager: false },
];

export function SettingsTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { member } = useWorkspace();
  const manager = isManager(member.role);
  const tabs = TABS.filter((tab) => manager || !tab.manager);
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-[24px] font-medium tracking-[-0.02em]">{manager ? "Settings" : "Your settings"}</h1>
        <nav aria-label="Settings" className="flex flex-wrap gap-x-1 border-b border-line">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-medium whitespace-nowrap ${
                  active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
