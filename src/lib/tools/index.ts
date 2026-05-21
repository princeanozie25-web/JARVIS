import { documentReaderTools } from "./doc-readers";
import { readOnlyFsTools } from "./fs-readonly";
import { fsUndoTool } from "./fs-undo";
import { writeFsTools } from "./fs-write";
import { memoryNoteTool } from "./memory-note";
import { memoryRecallTool } from "./memory-recall";
import { statusTool } from "./mock";
import { projectMutationTools, projectReadTools } from "./projects";
import { tools } from "./registry";

tools.register(statusTool);
for (const tool of readOnlyFsTools) {
  tools.register(tool);
}
for (const tool of documentReaderTools) {
  tools.register(tool);
}
for (const tool of writeFsTools) {
  tools.register(tool);
}
tools.register(memoryNoteTool);
tools.register(memoryRecallTool);
for (const tool of projectReadTools) {
  tools.register(tool);
}
for (const tool of projectMutationTools) {
  tools.register(tool);
}
tools.register(fsUndoTool);

export {
  fsListDirTool,
  fsReadFileTool,
  fsStatTool,
  readOnlyFsTools,
} from "./fs-readonly";
export type { FsPathInput } from "./fs-readonly";
export {
  docReadDocxTool,
  docReadPdfTool,
  docReadTxtTool,
  documentReaderTools,
} from "./doc-readers";
export type { ReadDocxInput, ReadPdfInput, ReadTxtInput } from "./doc-readers";
export {
  fsAppendFileTool,
  fsCreateFileTool,
  fsDeleteFileTool,
  fsMkdirTool,
  fsRenameTool,
  fsWriteFileTool,
  writeFsTools,
} from "./fs-write";
export type {
  AppendFileInput,
  CreateFileInput,
  DeleteFileInput,
  MkdirInput,
  RenameInput,
  WriteFileInput,
} from "./fs-write";
export { executeRollback, fsUndoTool } from "./fs-undo";
export type { UndoInput } from "./fs-undo";
export { memoryNoteScopeOf, memoryNoteTool } from "./memory-note";
export type { MemoryNoteInput } from "./memory-note";
export { memoryRecallScopeOf, memoryRecallTool } from "./memory-recall";
export type { MemoryRecallInput } from "./memory-recall";
export {
  projectAddSourceScopeOf,
  projectAddSourceTool,
  projectGetScopeOf,
  projectGetTool,
  projectIndexScopeOf,
  projectIndexTool,
  projectListScopeOf,
  projectListTool,
  projectMutationTools,
  projectPromoteTaskScopeOf,
  projectPromoteTaskTool,
  projectReadTools,
  projectRegisterScopeOf,
  projectRegisterTool,
  projectRegisterToolScaffold,
} from "./projects";
export type {
  ProjectAddSourceInput,
  ProjectGetInput,
  ProjectIndexInput,
  ProjectListInput,
  ProjectPromoteTaskInput,
  ProjectRegisterInput,
} from "./projects";
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
