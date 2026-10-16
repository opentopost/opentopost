/*
 * First-party analytics for the website and the app. No cookies: a random visitor id
 * in localStorage and a session id in sessionStorage. Respects Do Not Track and
 * Global Privacy Control. Events go to our own Convex deployment.
 */

import { convexSiteUrl } from "./convex-site";

type TrackEvent = {
  type: "pageview" | "click" | "engage";
  at: number;
  path: string;
  title?: string;
  label?: string;
  href?: string;
  activeMs?: number;
  scroll?: number;
};

const SESSION_IDLE = 30 * 60 * 1000;
const queue: TrackEvent[] = [];
const who: { memberId?: string; workspaceId?: string } = {};
let session: { id: string; utm: Record<string, string>; referrer?: string } | null = null;

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage can be blocked; the ids then last for this page only.
  }
}

let memoryVisitor: string | null = null;
function visitorId() {
  const stored = read(() => localStorage, "otp_vid");
  if (stored) return stored;
  memoryVisitor = memoryVisitor ?? randomId();
  write(() => localStorage, "otp_vid", memoryVisitor);
  return memoryVisitor;
}

function currentSession() {
  const now = Date.now();
  const raw = read(() => sessionStorage, "otp_sid");
  let parsed: { id: string; last: number; utm: Record<string, string>; referrer?: string } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!parsed || now - parsed.last > SESSION_IDLE) {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    const referrer = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer : undefined;
    parsed = { id: randomId(), last: now, utm, referrer };
  }
  parsed.last = now;
  write(() => sessionStorage, "otp_sid", JSON.stringify(parsed));
  session = parsed;
  return parsed;
}

export function trackingAllowed() {
  if (typeof window === "undefined") return false;
  if (location.hostname.startsWith("admin.")) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return false;
  // On the public site, measurement starts only after a yes to analytics. The signed-in app is the product itself.
  return true;
}

/** Ties this browser's events to a signed-in member, inside the app. */
export function identify(memberId?: string, workspaceId?: string) {
  who.memberId = memberId;
  who.workspaceId = workspaceId;
}

/** Replaces ids in paths, so /drafts/abc123… counts as /drafts/:id. */
export function normalizePath(path: string) {
  return (
    path
      .split("?")[0]
      .split("/")
      .map((part) => (/^[a-z0-9_-]{16,}$/i.test(part) || /^\d+$/.test(part) ? ":id" : part))
      .join("/") || "/"
  );
}

function device() {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function browserAndOs() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return { browser, os };
}

function endpoint() {
  const site = convexSiteUrl();
  return site ? `${site}/t` : null;
}

export function track(event: Omit<TrackEvent, "at">) {
  if (!trackingAllowed()) return;
  queue.push({ ...event, at: Date.now() });
  if (queue.length >= 40) flush();
}

export function flush() {
  if (!trackingAllowed() || queue.length === 0) return;
  const url = endpoint();
  if (!url) return;
  const s = currentSession();
  const { browser, os } = browserAndOs();
  const events = queue.splice(0, queue.length);
  const body = JSON.stringify({
    context: {
      visitorId: visitorId(),
      sessionId: s.id,
      host: location.host,
      referrer: s.referrer,
      utmSource: s.utm.utm_source,
      utmMedium: s.utm.utm_medium,
      utmCampaign: s.utm.utm_campaign,
      device: device(),
      browser,
      os,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      memberId: who.memberId,
      workspaceId: who.workspaceId,
    },
    events,
  });
  const blob = new Blob([body], { type: "text/plain" });
  if (navigator.sendBeacon?.(url, blob)) return;
  void fetch(url, { method: "POST", body, keepalive: true, mode: "no-cors", headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

export function sessionStarted() {
  return session !== null;
}


/** Who and where from, for funnel events such as Book a demo. Empty when tracking is off. */
export function attribution(): { visitorId?: string; referrer?: string; utmSource?: string; utmCampaign?: string } {
  if (!trackingAllowed()) return {};
  const current = currentSession();
  return { visitorId: visitorId(), referrer: current.referrer, utmSource: current.utm.utm_source, utmCampaign: current.utm.utm_campaign };
}
