"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Starts every new page at the top. Next.js does this for most links, but not in every browser or layout.
 * Back and forward keep the browser's own scroll position, and links to a #section still jump to it.
 */
function Reset() {
  const pathname = usePathname();
  const first = useRef(true);
  const fromHistory = useRef(false);

  useEffect(() => {
    const onPop = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

export function ScrollReset() {
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  );
}
