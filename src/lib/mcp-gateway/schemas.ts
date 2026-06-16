// MCP gateway — JSON-RPC 2.0 wire schemas + response builders (stdio transport).
// Schemas only; imports zod. No I/O, no mutation.

import { z } from "zod";

export const JSONRPC_VERSION = "2.0" as const;

/** A request from an (untrusted) MCP client. params is validated per-method. */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: z.union([z.string(), z.number()]).nullable().optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const ResourcesReadParamsSchema = z.object({
  uri: z.string().min(1),
});

export type JsonRpcId = string | number | null;

export interface JsonRpcSuccess {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  error: { code: number; message: string };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

// JSON-RPC reserved codes we use. Everything that is a denial collapses to ONE
// uniform code+message (ID-5: the error channel must not enumerate surfaces or
// scopes). Malformed envelopes get the standard invalid-request code (that
// reveals nothing about which surfaces exist).
export const RPC_INVALID_REQUEST = -32600;
export const RPC_DENIED = -32000;
export const UNIFORM_DENIAL_MESSAGE = "request denied";

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function rpcInvalidRequest(id: JsonRpcId): JsonRpcError {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code: RPC_INVALID_REQUEST, message: "invalid request" },
  };
}

/** The ONE denial response. Used for: unauthenticated, unknown method, unknown
 * or forbidden resource, bad params — all identical, by design (ID-5). */
export function rpcDenied(id: JsonRpcId): JsonRpcError {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code: RPC_DENIED, message: UNIFORM_DENIAL_MESSAGE },
  };
}
