"use client";

import { KindeProvider, useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useMemo, type ReactNode } from "react";
import { ScrollReset } from "@/components/scroll-reset";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useKindeForConvex() {
  const { isLoading, isAuthenticated } = useKindeBrowserClient();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const response = await fetch(
        `/api/convex-token${forceRefreshToken ? "?refresh=1" : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { token: string | null };
      return body.token;
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading: isLoading ?? true,
      isAuthenticated: isAuthenticated ?? false,
      fetchAccessToken,
    }),
    [isLoading, isAuthenticated, fetchAccessToken],
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
