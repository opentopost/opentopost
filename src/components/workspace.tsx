"use client";

import { createContext, useContext } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

export type Current = NonNullable<FunctionReturnType<typeof api.workspaces.current>>;

export const WorkspaceContext = createContext<Current | null>(null);

export function useWorkspace(): Current {
  const current = useContext(WorkspaceContext);
  if (!current) throw new Error("useWorkspace must be used inside the app layout");
  return current;
}
