import { readOnlyFsTools } from "./fs-readonly";
import { statusTool } from "./mock";
import { tools } from "./registry";

tools.register(statusTool);
for (const tool of readOnlyFsTools) {
  tools.register(tool);
}

export {
  fsListDirTool,
  fsReadFileTool,
  fsStatTool,
  readOnlyFsTools,
} from "./fs-readonly";
export type { FsPathInput } from "./fs-readonly";
export {
  isProtectedPath,
  resolveSafePath,
  SafePathError,
  workspaceRootFromEnv,
} from "./fs-safe-path";
export type { SafePathResult } from "./fs-safe-path";
export { statusTool } from "./mock";
export type { StatusToolInput } from "./mock";
export { providerToolMetadata, providerToolName } from "./provider-metadata";
export type { ProviderToolMetadata } from "./provider-metadata";
export {
  assertToolsRuntimeGuard,
  checkToolsRuntimeGuard,
  isLoopbackHost,
  parseToolsEnabled,
  toolsRuntimeOptionsFromEnv,
} from "./local-guard";
export type {
  ToolsRuntimeGuardOptions,
  ToolsRuntimeGuardResult,
} from "./local-guard";
export { ToolRegistry, tools } from "./registry";
export { InProcessToolRuntime, toolRuntime } from "./runtime";
export type {
  ReversibilityClass,
  RunToolOptions,
  Tool,
  ToolContext,
  ToolResult,
  ToolRuntime,
} from "./types";
