import type { Tool } from "../tools";

export const VOICE_ALLOWED_PROJECT_READ_TOOL_IDS = [
  "project.list",
  "project.get",
  "project.summarize",
] as const;

export type VoiceProjectToolBoundaryDecision =
  | "allowed_read_only_project_tool"
  | "denied_non_project_tool"
  | "denied_unregistered_project_tool"
  | "denied_project_mutation_tool"
  | "denied_project_tool_not_voice_allowed";

export interface VoiceProjectToolBoundaryResult {
  allowed: boolean;
  toolId: string;
  decision: VoiceProjectToolBoundaryDecision;
  metadataOnly: true;
  canApprove: false;
  canMutate: false;
}

export interface VoiceProjectToolRegistry {
  has(id: string): boolean;
  get(id: string): Tool;
}

const voiceAllowedProjectReadToolIds = new Set<string>(
  VOICE_ALLOWED_PROJECT_READ_TOOL_IDS,
);

export function classifyVoiceProjectTool(
  registry: VoiceProjectToolRegistry,
  toolId: string,
): VoiceProjectToolBoundaryResult {
  if (!toolId.startsWith("project.")) {
    return result(toolId, false, "denied_non_project_tool");
  }

  if (!registry.has(toolId)) {
    return result(toolId, false, "denied_unregistered_project_tool");
  }

  const tool = registry.get(toolId);
  if (
    voiceAllowedProjectReadToolIds.has(tool.id) &&
    tool.requiredSafetyTag === "ALLOW" &&
    tool.reversibilityClass === "PURE_READ"
  ) {
    return result(tool.id, true, "allowed_read_only_project_tool");
  }

  if (
    tool.requiredSafetyTag !== "ALLOW" ||
    tool.reversibilityClass !== "PURE_READ"
  ) {
    return result(tool.id, false, "denied_project_mutation_tool");
  }

  return result(tool.id, false, "denied_project_tool_not_voice_allowed");
}

function result(
  toolId: string,
  allowed: boolean,
  decision: VoiceProjectToolBoundaryDecision,
): VoiceProjectToolBoundaryResult {
  return {
    allowed,
    toolId,
    decision,
    metadataOnly: true,
    canApprove: false,
    canMutate: false,
  };
}
