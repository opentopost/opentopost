export type Role = "owner" | "admin" | "reviewer" | "member";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  member: "Member",
};

export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including billing and deleting the workspace.",
  admin: "Sources, rules, members, and settings. Not billing.",
  reviewer: "Approves drafts before they are posted.",
  member: "Writes and posts their own drafts.",
};

export const isManager = (role: string) => role === "owner" || role === "admin";
export const isReviewer = (role: string) => isManager(role) || role === "reviewer";
