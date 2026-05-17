import { statusTool } from "./mock";
import { tools } from "./registry";

tools.register(statusTool);

export { statusTool } from "./mock";
export type { StatusToolInput } from "./mock";
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
