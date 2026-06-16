// MCP gateway — pure JSON-RPC method handler (no I/O; fully unit-testable).
//
// Serves EXACTLY the read surface in resources.ts. Auth-gated: an
// unauthenticated session gets the uniform denial for everything (fail-closed).
// Every refusal — unauthenticated, unknown method, unknown/forbidden resource,
// bad params — collapses to the SAME denial (ID-5). No mutation path exists:
// there is no method that proposes, approves, executes, or writes.

import { EXPOSED_RESOURCES, readResourceByUri } from "./resources";
import {
  JsonRpcRequestSchema,
  ResourcesReadParamsSchema,
  rpcDenied,
  rpcInvalidRequest,
  rpcResult,
  type JsonRpcId,
  type JsonRpcResponse,
} from "./schemas";

export const MCP_PROTOCOL_VERSION = "2025-06-18" as const;
export const MCP_SERVER_INFO = {
  name: "jarvis-mcp-gateway",
  version: "24b1",
} as const;

export interface GatewaySession {
  authenticated: boolean;
  /** Server-derived (token hash); never client-chosen. Null when refused. */
  clientId: string | null;
}

function extractId(raw: unknown): JsonRpcId {
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return null;
}

function isNotification(raw: unknown): boolean {
  // A JSON-RPC notification has no `id`; it receives no response.
  return !(raw && typeof raw === "object" && "id" in raw);
}

/**
 * Handle one JSON-RPC request. Returns the response, or `null` for a
 * notification (which gets no reply). The handler never mutates anything and
 * never reads a client-supplied identity — `session.clientId` is server-derived
 * upstream (identity.ts).
 */
export function handleJsonRpcRequest(
  raw: unknown,
  session: GatewaySession,
): JsonRpcResponse | null {
  const parsed = JsonRpcRequestSchema.safeParse(raw);
  if (!parsed.success) {
    if (isNotification(raw)) return null;
    return rpcInvalidRequest(extractId(raw));
  }

  const request = parsed.data;
  const id: JsonRpcId = request.id ?? null;
  const notification = request.id === undefined || request.id === null;

  // Fail-closed: no authenticated connection => uniform denial for everything.
  if (!session.authenticated) {
    return notification ? null : rpcDenied(id);
  }

  switch (request.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: MCP_SERVER_INFO,
        capabilities: { resources: {} },
      });

    case "resources/list":
      return rpcResult(id, {
        resources: EXPOSED_RESOURCES.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          title: resource.title,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      });

    case "resources/read": {
      const params = ResourcesReadParamsSchema.safeParse(request.params);
      if (!params.success) return rpcDenied(id);
      const outcome = readResourceByUri(params.data.uri);
      if (!outcome.ok) return rpcDenied(id); // unknown AND forbidden look identical
      return rpcResult(id, {
        contents: [
          {
            uri: outcome.uri,
            mimeType: outcome.mimeType,
            text: outcome.text,
          },
        ],
      });
    }

    default:
      // Unknown method: uniform denial, never "method not found" (no enumeration).
      return notification ? null : rpcDenied(id);
  }
}
