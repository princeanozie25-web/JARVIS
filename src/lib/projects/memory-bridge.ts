import type DatabaseType from "better-sqlite3";

export const PROJECT_MEMORY_BRIDGE_FEATURE_FLAG =
  "JARVIS_PROJECT_MEMORY_BRIDGE_ENABLED";

export type ProjectMemoryBridgeReason =
  | "feature_disabled"
  | "metadata_api_unavailable";

export interface ProjectMemoryBridgeSourcePointer {
  kind: "memory_slug";
  ref: string;
  metadataOnly: true;
  contentRead: false;
}

export interface ProjectMemoryBridgeResult {
  enabled: boolean;
  metadataRead: boolean;
  memoryIsPeerSource: true;
  derivedState: true;
  mutation: "none";
  reason: ProjectMemoryBridgeReason;
  sourcePointers: ProjectMemoryBridgeSourcePointer[];
}

export interface DiscoverProjectMemorySourcesInput {
  db: DatabaseType.Database;
  projectId?: string | null;
  projectSlug?: string | null;
  env?: Record<string, string | undefined>;
}

export function isProjectMemoryBridgeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const value = env[PROJECT_MEMORY_BRIDGE_FEATURE_FLAG]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "enabled";
}

function bridgeResult(input: {
  enabled: boolean;
  reason: ProjectMemoryBridgeReason;
}): ProjectMemoryBridgeResult {
  return {
    enabled: input.enabled,
    metadataRead: false,
    memoryIsPeerSource: true,
    derivedState: true,
    mutation: "none",
    reason: input.reason,
    sourcePointers: [],
  };
}

export function discoverProjectMemorySourcePointers(
  input: DiscoverProjectMemorySourcesInput,
): ProjectMemoryBridgeResult {
  if (!isProjectMemoryBridgeEnabled(input.env)) {
    return bridgeResult({ enabled: false, reason: "feature_disabled" });
  }

  // Existing memory accessors expose full memory rows including content. A13
  // therefore fails closed until a metadata-only memory API exists.
  return bridgeResult({ enabled: true, reason: "metadata_api_unavailable" });
}
