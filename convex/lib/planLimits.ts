import { HOSTED, type Limits } from "./limits";

export type Plan = "free" | "pro" | "team";

export const TEAM_INCLUDED_SEATS = 3;

/** What Pro costs one person each month, in US dollars. */
export const PRO_USD_MONTH = 19;

export const PLAN_LIMITS: Record<Plan, Limits> = {
  free: HOSTED,
  pro: {
    workspacesPerUser: HOSTED.workspacesPerUser,
    membersPerWorkspace: 1,
    scheduledScansPerWeek: 7,
    manualScansPerDay: 10,
    sources: 10,
    mcpServers: 5,
  },
  team: {
    workspacesPerUser: HOSTED.workspacesPerUser,
    membersPerWorkspace: Infinity,
    scheduledScansPerWeek: 7,
    manualScansPerDay: 25,
    sources: 25,
    mcpServers: 10,
  },
};

/** Model calls included each month when we provide the models. */
export const AI_CALLS = { pro: 1000, teamPerSeat: 500 };

