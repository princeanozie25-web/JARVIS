// MCP gateway (Phase 24B-1) — public surface.
//
// A LOCAL stdio MCP server that exposes EXACTLY ONE read this slice: the
// pipeline view-model (static governance topology), sanitized, behind a
// fail-closed identity seam, and STRUCTURALLY non-mutating — its entire import
// graph reaches only schemas + the read projection (proven by the GATE-2
// transitive import allowlist test). No proposal path, no executor, no write.

export { startStdioServer } from "./server";
export type { StartStdioServerOptions, RunningStdioServer } from "./server";

export {
  handleJsonRpcRequest,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
} from "./protocol";
export type { GatewaySession } from "./protocol";

export {
  EXPOSED_RESOURCES,
  PIPELINE_VIEW_MODEL_URI,
  PIPELINE_VIEW_MODEL_NAME,
  listExposedResourceNames,
  listExposedResourceUris,
  readPipelineViewModel,
  readResourceByUri,
} from "./resources";
export type {
  ExposedResourceDescriptor,
  ResourceReadOutcome,
} from "./resources";

export {
  authenticateConnection,
  deriveClientId,
  hashToken,
  loadProvisionedTokenHashesFromEnv,
} from "./identity";
export type { ConnectionAuthResult } from "./identity";

export {
  findForbiddenFields,
  sanitizeReadPayload,
  normalizeFieldKey,
  MCP_GATEWAY_FORBIDDEN_KEY_LIST,
} from "./sanitizer";

export {
  JsonRpcRequestSchema,
  rpcResult,
  rpcDenied,
  rpcInvalidRequest,
  UNIFORM_DENIAL_MESSAGE,
} from "./schemas";
export type { JsonRpcResponse } from "./schemas";
