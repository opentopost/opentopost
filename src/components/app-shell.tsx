"use client";

import { isManager, isReviewer, ROLE_LABELS } from "@/lib/roles";
import { identify } from "@/lib/track";
import { LoginLink, LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Menu,
  Milestone,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plug,
  Plus,
  Radar,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { Logo, Mark } from "@/components/mark";
import { Badge, buttonClass, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import { WorkspaceContext, type Current } from "@/components/workspace";
import { AppLoader } from "./loader";
import { saveHasAccount } from "./marketing/cta";

type Access = "all" | "reviewer" | "manager";
type Space = "personal" | "company";
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  section?: string;
  access: Access;
  space: Space;
  count?: "review";
  memberOnly?: boolean;
};
/*
 * Two views. "You" has everything about your own posts. "Company" has the company page, review,
 * team numbers and workspace setup, and only owners and admins see it. Reviewers who are not
 * managers get Review in their own view.
 */
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, access: "all", space: "personal" },
  { href: "/moments", label: "Moments", icon: Milestone, section: "Your posts", access: "all", space: "personal" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, section: "Your posts", access: "all", space: "personal" },
  { href: "/drafts", label: "Drafts", icon: FileText, section: "Your posts", access: "all", space: "personal" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, section: "Your posts", access: "all", space: "personal" },
  { href: "/voice", label: "Your voice", icon: PenLine, section: "Your posts", access: "all", space: "personal" },
  {
    href: "/review",
    label: "Review",
    icon: ClipboardCheck,
    section: "Team",
    access: "reviewer",
    space: "personal",
    count: "review",
    memberOnly: true,
  },
  { href: "/company", label: "Overview", icon: LayoutGrid, section: "Company", access: "manager", space: "company" },
  { href: "/review", label: "Review", icon: ClipboardCheck, section: "Company", access: "manager", space: "company", count: "review" },
  { href: "/recap", label: "Team recap", icon: BarChart3, section: "Team", access: "manager", space: "company" },
  { href: "/insights", label: "Insights", icon: Radar, section: "Team", access: "manager", space: "company" },
  { href: "/sources", label: "Sources", icon: Plug, section: "Workspace", access: "manager", space: "company" },
  { href: "/settings/members", label: "Members", icon: Users, section: "Workspace", access: "manager", space: "company" },
];
const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings, access: "all", space: "personal" };
const COMPANY_PATHS = ["/company", "/review", "/recap", "/insights", "/sources", "/settings/members"];
const SPACE_KEY = "opentopost:space";

const allowed = (access: Access, role: string) => access === "all" || (access === "manager" ? isManager(role) : isReviewer(role));

const MANAGER_SETTINGS = ["general", "members", "rules", "model", "pipeline", "security", "billing"];

/** Members open their own pages. Company and workspace pages are for owners and admins, Review for reviewers. */
function canOpen(pathname: string, role: string) {
  const setting = pathname.match(/^\/settings\/([^/]+)/)?.[1];
  if (setting && MANAGER_SETTINGS.includes(setting)) return isManager(role);
  const item = NAV.find((row) => !row.href.startsWith("/settings") && (pathname === row.href || pathname.startsWith(`${row.href}/`)));
  return item ? allowed(item.access, role) : true;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavLink({
  item,
  pathname,
  onNavigate,
  reviewCount,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  reviewCount: number;
  collapsed: boolean;
}) {
  const active =
    item.href === "/settings"
      ? pathname === "/settings" || (pathname.startsWith("/settings/") && !pathname.startsWith("/settings/members"))
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`relative flex h-8 items-center gap-2.5 rounded-item text-[14px] font-medium ${collapsed ? "w-8 justify-center" : "px-2"} ${
        active ? "bg-accent-soft text-ink" : "text-ink hover:bg-fill"
      }`}
    >
      <item.icon size={16} strokeWidth={1.75} />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {item.count === "review" && reviewCount > 0 && (
        <span
          className={`rounded-full bg-accent text-[11px] font-semibold text-white ${collapsed ? "absolute -top-1 -right-1 px-1 leading-4" : "px-1.5"}`}
        >
          {reviewCount}
        </span>
      )}
    </Link>
  );
}

/** Which view the sidebar shows. Company pages always open the company view; elsewhere the last choice stays. */
function useSpace(pathname: string, role: string): [Space, (space: Space) => void] {
  const [chosen, setChosen] = useState<Space>("personal");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (localStorage.getItem(SPACE_KEY) === "company") setChosen("company");
      } catch {
        // Without storage the sidebar starts on the personal view.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const set = useCallback((space: Space) => {
    setChosen(space);
    try {
      localStorage.setItem(SPACE_KEY, space);
    } catch {
      // The choice lasts until the page reloads.
    }
  }, []);
  if (!isManager(role)) return ["personal", set];
  if (COMPANY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return ["company", set];
  if (["/dashboard", "/moments", "/ideas", "/drafts", "/calendar", "/voice"].some((path) => pathname === path || pathname.startsWith(`${path}/`)))
    return ["personal", set];
  return [chosen, set];
}

function SpaceSwitch({ space, onChange, collapsed = false }: { space: Space; onChange: (space: Space) => void; collapsed?: boolean }) {
  const router = useRouter();
  const go = (next: Space) => {
    onChange(next);
    router.push(next === "company" ? "/company" : "/dashboard");
  };
  const options: { value: Space; label: string; icon: typeof LayoutGrid }[] = [
    { value: "personal", label: "You", icon: User },
    { value: "company", label: "Company", icon: Building2 },
  ];
  return (
    <div role="tablist" aria-label="View" className={`flex rounded-item bg-fill p-0.5 ${collapsed ? "flex-col gap-0.5" : ""}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={space === option.value}
          title={option.label}
          onClick={() => go(option.value)}
          className={`flex h-7 items-center justify-center gap-1.5 rounded-control text-[13px] font-medium ${collapsed ? "w-8" : "flex-1"} ${
            space === option.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <option.icon size={14} strokeWidth={1.75} />
          {!collapsed && option.label}
        </button>
      ))}
    </div>
  );
}

function NavLinks({
  pathname,
  role,
  space,
  onNavigate,
  reviewCount = 0,
  collapsed = false,
}: {
  pathname: string;
  role: string;
  space: Space;
  onNavigate?: () => void;
  reviewCount?: number;
  collapsed?: boolean;
}) {
  const manager = isManager(role);
  const items = NAV.filter((item) => item.space === space && allowed(item.access, role) && !(item.memberOnly && manager));
  return (
    <>
      {items.map((item, index) => {
        const group = item.section && item.section !== items[index - 1]?.section ? item.section : null;
        return (
          <div key={`${item.space}-${item.href}`} className="contents">
            {group &&
              (collapsed ? <div className="mx-2 my-2 border-t border-line" /> : <p className="px-2 pt-4 pb-1 text-[12px] text-muted">{group}</p>)}
            <NavLink item={item} pathname={pathname} onNavigate={onNavigate} reviewCount={reviewCount} collapsed={collapsed} />
          </div>
        );
      })}
    </>
  );
}

function WorkspaceBox({ current }: { current: Current }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const switchTo = useMutation(api.workspaces.switchTo);
  const create = useMutation(api.workspaces.create);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create({ name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      setName("");
      setCreating(false);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center gap-2 rounded-item border border-line bg-surface/60 px-2 text-left hover:bg-surface"
      >
        <Mark size={24} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{current.workspace.name}</span>
        {current.mode !== "hosted" && <Badge>Self-hosted</Badge>}
        <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 top-11 z-50 flex flex-col gap-0.5 rounded-item border border-line bg-surface p-1 shadow-[0_16px_32px_-12px_rgb(16_16_16/0.25)]"
        >
          <p className="px-2 pt-1 pb-1 text-[12px] text-muted">Workspaces</p>
          {current.workspaces.map((ws) => (
            <button
              key={ws.workspaceId}
              type="button"
              role="menuitem"
              onClick={async () => {
                await switchTo({ workspaceId: ws.workspaceId });
                setOpen(false);
              }}
              className="flex h-8 items-center gap-2 rounded-control px-2 text-left text-[14px] hover:bg-fill"
            >
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              {ws.workspaceId === current.workspace._id && <Check size={14} strokeWidth={2} className="text-accent" />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          {creating ? (
            <form onSubmit={submit} className="flex flex-col gap-1.5 p-1">
              <label htmlFor="new-workspace" className="sr-only">
                Workspace name
              </label>
              <input
                id="new-workspace"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Workspace name"
                className={`${inputClass} h-8`}
              />
              {error && <p className="text-[12px] text-danger">{error}</p>}
              <button type="submit" className={buttonClass("primary", "sm")} disabled={name.trim().length < 2}>
                Create workspace
              </button>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setCreating(true)}
              className="flex h-8 items-center gap-2 rounded-control px-2 text-left text-[14px] hover:bg-fill"
            >
              <Plus size={14} strokeWidth={1.75} />
              New workspace
            </button>
          )}
          <Link
            href="/settings/general"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center gap-2 rounded-control px-2 text-[14px] hover:bg-fill"
          >
            <Settings size={14} strokeWidth={1.75} />
            Workspace settings
          </Link>
        </div>
      )}
    </div>
  );
}

function UserRow({ current }: { current: Current }) {
  return (
    <div className="flex items-center gap-2 border-t border-line p-3">
      <span className="inline-flex size-6 items-center justify-center rounded-control bg-sky-mid text-[11px] font-semibold">
        {initials(current.member.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{current.member.name}</span>
      <Badge tone="fill">{ROLE_LABELS[current.member.role]}</Badge>
      {!current.workspace.demo && (
        <LogoutLink aria-label="Sign out" className={buttonClass("ghost", "sm", "w-8 px-0")}>
          <LogOut size={14} strokeWidth={1.75} />
        </LogoutLink>
      )}
    </div>
  );
}

function useReviewCount(current: Current) {
  const queue = useQuery(api.drafts.reviewQueue, isReviewer(current.member.role) ? { workspaceId: current.workspace._id } : "skip");
  return queue?.length ?? 0;
}

const SIDEBAR_KEY = "opentopost:sidebar";

function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // Reads the saved choice after mount, so the server and first client render match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, value ? "open" : "collapsed");
      } catch {}
      return !value;
    });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);
  return { collapsed, toggle };
}

function Sidebar({ current, pathname }: { current: Current; pathname: string }) {
  const reviewCount = useReviewCount(current);
  const [space, setSpace] = useSpace(pathname, current.member.role);
  const { collapsed, toggle } = useSidebar();
  const toggleLabel = collapsed ? "Open sidebar" : "Close sidebar";
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-canvas/90 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[56px]" : "w-[272px]"
      }`}
    >
      <div className={`flex flex-col gap-3 p-2 ${collapsed ? "items-center" : ""}`}>
        {collapsed ? (
          <Link href="/dashboard" aria-label="Dashboard" className="flex h-10 items-center">
            <Mark size={28} />
          </Link>
        ) : (
          <WorkspaceBox current={current} />
        )}
        {isManager(current.member.role) && <SpaceSwitch space={space} onChange={setSpace} collapsed={collapsed} />}
        <nav aria-label="App" className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`}>
          <NavLinks pathname={pathname} role={current.member.role} space={space} reviewCount={reviewCount} collapsed={collapsed} />
        </nav>
      </div>
      <div className={`mt-auto flex flex-col ${collapsed ? "items-center gap-2 pb-3" : ""}`}>
        <div className={collapsed ? "" : "px-2 pb-1"}>
          <NavLink item={SETTINGS} pathname={pathname} reviewCount={0} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          title={`${toggleLabel} (Ctrl or Cmd + \\)`}
          className={`flex h-8 items-center gap-2.5 rounded-item text-[13px] text-muted hover:bg-fill hover:text-ink ${
            collapsed ? "w-8 justify-center" : "mx-2 mb-2 px-2"
          }`}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
          {!collapsed && "Close sidebar"}
        </button>
        {collapsed ? (
          <span
            title={current.member.name}
            className="inline-flex size-7 items-center justify-center rounded-control bg-sky-mid text-[11px] font-semibold"
          >
            {initials(current.member.name)}
          </span>
        ) : (
          <UserRow current={current} />
        )}
      </div>
    </aside>
  );
}

function MobileBar({ current, pathname }: { current: Current; pathname: string }) {
  const [open, setOpen] = useState(false);
  const reviewCount = useReviewCount(current);
  const [space, setSpace] = useSpace(pathname, current.member.role);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas md:hidden">
      <div className="flex h-12 items-center gap-2 px-3">
        <Link href="/dashboard" aria-label="Dashboard" className="mr-auto">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-fill"
        >
          {open ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-12 bottom-0 z-40 flex flex-col bg-canvas">
          <div className="flex flex-col gap-3 p-3">
            <WorkspaceBox current={current} />
            {isManager(current.member.role) && (
              <SpaceSwitch
                space={space}
                onChange={(next) => {
                  setSpace(next);
                  setOpen(false);
                }}
              />
            )}
            <nav aria-label="App" className="flex flex-col gap-0.5">
              <NavLinks pathname={pathname} role={current.member.role} space={space} onNavigate={() => setOpen(false)} reviewCount={reviewCount} />
              <NavLink item={SETTINGS} pathname={pathname} onNavigate={() => setOpen(false)} reviewCount={0} collapsed={false} />
            </nav>
          </div>
          <div className="mt-auto">
            <UserRow current={current} />
          </div>
        </div>
      )}
    </header>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">{children}</main>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const current = useQuery(api.workspaces.current, isAuthenticated ? {} : "skip");
  const ensure = useMutation(api.workspaces.ensure);
  const requested = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || current !== null || requested.current) return;
    requested.current = true;
    let accessCode: string | undefined;
    try {
      accessCode = localStorage.getItem("otp_access") ?? undefined;
    } catch {
      accessCode = undefined;
    }
    const started = ensure({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accessCode });
    started.catch(() => setFailed(true));
  }, [isAuthenticated, current, ensure]);

  useEffect(() => {
    if (!current) return;
    identify(current.member._id, current.workspace._id);
    // The marketing site and access links show Sign in only from now on.
    saveHasAccount();
  }, [current]);

  if (!isLoading && !isAuthenticated) {
    return (
      <CenterMessage>
        <Mark size={48} />
        <h1 className="text-[20px] font-medium">Your session ended</h1>
        <p className="text-muted">Sign in again to open your workspace.</p>
        <LoginLink postLoginRedirectURL="/dashboard" className={buttonClass("primary")}>
          Sign in
        </LoginLink>
      </CenterMessage>
    );
  }


  if (failed && !current) {
    return (
      <CenterMessage>
        <Mark size={48} />
        <h1 className="text-[20px] font-medium">We could not open your workspace</h1>
        <p className="max-w-[420px] text-muted">Reload the page to try again. If it keeps happening, sign out and sign in again.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary")}>
            Reload
          </button>
          <LogoutLink className={buttonClass("secondary")}>Sign out</LogoutLink>
        </div>
      </CenterMessage>
    );
  }

  if (!current) {
    return <AppLoader step={isLoading ? 0 : current === undefined ? 1 : 2} />;
  }

  return (
    <WorkspaceContext.Provider value={current}>
      <div className="flex min-h-dvh w-full">
        <Sidebar current={current} pathname={pathname} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar current={current} pathname={pathname} />
          <main className="w-full flex-1 px-4 py-8 md:px-8 md:pt-12 md:pb-10">
            {canOpen(pathname, current.member.role) ? (
              children
            ) : (
              <div className="mx-auto flex max-w-[440px] flex-col items-center gap-3 pt-16 text-center">
                <h1 className="text-[20px] font-medium">This page is for workspace owners</h1>
                <p className="text-[14px] text-muted">Your posts, drafts and voice are all in the sidebar.</p>
                <Link href="/dashboard" className={buttonClass("primary")}>
                  Go home
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
