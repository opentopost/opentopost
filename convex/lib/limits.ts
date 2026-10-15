export type DeploymentMode = "hosted" | "selfhosted";

export type Limits = {
  workspacesPerUser: number;
  membersPerWorkspace: number;
  scheduledScansPerWeek: number;
  manualScansPerDay: number;
  sources: number;
  mcpServers: number;
};

export const HOSTED: Limits = {
  workspacesPerUser: 1,
  membersPerWorkspace: 5,
  scheduledScansPerWeek: 1,
  manualScansPerDay: 1,
  sources: 2,
  mcpServers: 1,
};

export const SELF_HOSTED: Limits = {
  workspacesPerUser: Infinity,
  membersPerWorkspace: Infinity,
  scheduledScansPerWeek: Infinity,
  manualScansPerDay: Infinity,
  sources: Infinity,
  mcpServers: Infinity,
};

export function deploymentMode(): DeploymentMode {
  return process.env.DEPLOYMENT_MODE === "hosted" ? "hosted" : "selfhosted";
}

export function limits(): Limits {
  return deploymentMode() === "hosted" ? HOSTED : SELF_HOSTED;
}
