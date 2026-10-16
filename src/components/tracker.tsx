"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { APP_PREFIXES } from "@/lib/app-paths";
import { flush, normalizePath, track, trackingAllowed } from "@/lib/track";

const IDLE = 60_000;

function labelFor(element: Element, inApp: boolean): string | undefined {
  const explicit = element.getAttribute("data-track") ?? element.getAttribute("aria-label");
  if (explicit) return explicit.trim();
  // In the app, link text can be someone's private draft or idea title, so only button text is kept.
  if (inApp && element.tagName === "A") return undefined;
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 80) : element.getAttribute("title") ?? undefined;
}

function hrefFor(element: Element): string | undefined {
  if (element.tagName !== "A") return undefined;
  const raw = element.getAttribute("href");
  if (!raw) return undefined;
  if (raw.startsWith("mailto:")) return raw.split("?")[0];
  try {
    const url = new URL(raw, location.href);
    return url.host === location.host ? normalizePath(url.pathname) : `${url.host}${normalizePath(url.pathname)}`;
  } catch {
    return undefined;
  }
}

/** Records page views, clicks, scroll depth, and active time on each page. */
export function Tracker() {
  const pathname = usePathname();
  const consentKey = null;
  const page = useRef<{ path: string; activeMs: number; scroll: number; lastTick: number; lastInput: number } | null>(null);

  // Clicks, scroll, activity, and sending.
  useEffect(() => {
    if (!trackingAllowed()) return;
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a, button, [role=button], [data-track], summary, input[type=submit]");
      if (!target || target.closest("[data-track-ignore]")) return;
      const path = normalizePath(location.pathname);
      const inApp = APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      const href = hrefFor(target);
      track({ type: "click", path, label: labelFor(target, inApp) ?? href, href });
    };
    const onScroll = () => {
      if (!page.current) return;
      const doc = document.documentElement;
      const depth = Math.round(((window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1)) * 100);
      page.current.scroll = Math.max(page.current.scroll, Math.min(100, depth));
    };
    const onInput = () => {
      if (page.current) page.current.lastInput = Date.now();
    };
    const tick = window.setInterval(() => {
      const current = page.current;
      if (!current) return;
      const now = Date.now();
      if (document.visibilityState === "visible" && now - current.lastInput < IDLE) current.activeMs += now - current.lastTick;
      current.lastTick = now;
    }, 1000);
    const send = window.setInterval(flush, 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        if (page.current) {
          track({ type: "engage", path: page.current.path, activeMs: page.current.activeMs, scroll: page.current.scroll });
          page.current.activeMs = 0;
        }
        flush();
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    for (const name of ["pointermove", "keydown", "scroll", "touchstart"]) window.addEventListener(name, onInput, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      for (const name of ["pointermove", "keydown", "scroll", "touchstart"]) window.removeEventListener(name, onInput);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.clearInterval(tick);
      window.clearInterval(send);
    };
  }, [consentKey]);

  // A page view on each route, and the time spent on the one before it.
  useEffect(() => {
    if (!trackingAllowed()) return;
    const previous = page.current;
    if (previous && (previous.activeMs > 0 || previous.scroll > 0)) {
      track({ type: "engage", path: previous.path, activeMs: previous.activeMs, scroll: previous.scroll });
    }
    const path = normalizePath(pathname);
    const now = Date.now();
    page.current = { path, activeMs: 0, scroll: 0, lastTick: now, lastInput: now };
    // Let the new page render before reading its title and height.
    const timer = window.setTimeout(() => {
      track({ type: "pageview", path, title: document.title });
      window.dispatchEvent(new Event("scroll"));
      flush();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, consentKey]);

  return null;
}
