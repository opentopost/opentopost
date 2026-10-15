import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/*
 * The open-source copy has no demo-mode lock, no access links and no hosted pilots.
 * Anyone who signs in gets their own workspace.
 */

export type Entry = {
  label: string | null;
  joinWorkspaceId: Id<"workspaces"> | null;
  onJoined: () => Promise<void>;
  onCreated: (workspaceId: Id<"workspaces">) => Promise<void>;
};

export async function entryFor(_ctx: MutationCtx, _identity: { email?: string | null }, _accessCode: string | undefined): Promise<Entry> {
  return { label: null, joinWorkspaceId: null, onJoined: async () => {}, onCreated: async () => {} };
}
