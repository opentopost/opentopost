"use client";

import { KindeProvider, useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { ScrollReset } from "@/components/scroll-reset";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const subscribeNever = () => () => {};

function useKindeForConvex() {
  const { isLoading, isAuthenticated } = useKindeBrowserClient();
  // demo.opentopost.com signs in with a token the site signs for a fixed demo person.
  const demo = useSyncExternalStore(
    subscribeNever,
    () => window.location.hostname.startsWith("demo."),
    () => null,
  );

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const response = await fetch(
        demo ? "/api/demo/token" : `/api/convex-token${forceRefreshToken ? "?refresh=1" : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { token: string | null };
      return body.token;
    },
    [demo],
  );

  return useMemo(
    () => ({
      isLoading: demo === null ? true : demo ? false : (isLoading ?? true),
      isAuthenticated: demo ? true : (isAuthenticated ?? false),
      fetchAccessToken,
    }),
    [demo, isLoading, isAuthenticated, fetchAccessToken],
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <KindeProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useKindeForConvex}>
        <ScrollReset />
        {children}
      </ConvexProviderWithAuth>
    </KindeProvider>
  );
}
