// MCP gateway — pure JSON-RPC method handler (no I/O; fully unit-testable).
//
// Serves EXACTLY the read surface in resources.ts. Auth-gated: an
// unauthenticated session gets the uniform denial for everything (fail-closed).
// Every refusal — unauthenticated, unknown method, unknown/forbidden resource,
// bad params — collapses to the SAME denial (ID-5). No mutation path exists:
// there is no method that proposes, approves, executes, or writes.
//
// The queue-status read (24B-2) is served through an INJECTED reader passed by
// the caller. When it is absent (null), queue-status reads collapse to the same
// uniform denial as any other miss — the handler imports no DB/approvals tree.

import { EXPOSED_RESOURCES, readResourceByUri } from "./resources";
import type { QueueStatusReader } from "./queue-status";
import { isReadAllowed, type ClientScope } from "./scope";
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
  version: "24b2",
} as const;

export interface GatewaySession {
  authenticated: boolean;
  /** Server-derived (token hash); never client-chosen. Null when refused. */
  clientId: string | null;
  /** Per-client read/propose scope (24D-2a). When present, read-scope (ID-2) is
   * enforced; absent/null is the legacy unscoped seam (24B behavior unchanged). */
  scope?: ClientScope | null;
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
 *
 * `queueStatus` is the injected counts-only reader for the queue-status read; it
 * defaults to null so callers that never wired a counts source (and every
 * 24B-1 call site) see queue-status reads collapse to the uniform denial.
 *
 * `admitRead` is the injected per-client read rate gate (24D-3, ID-3): given the
 * server-derived client_id it returns false when the client is over its read
 * rate (or muted), and the read collapses to the SAME uniform denial. It defaults
 * to allow-all so every pre-24D-3 call site is unchanged.
 */
export function handleJsonRpcRequest(
  raw: unknown,
  session: GatewaySession,
  queueStatus: QueueStatusReader | null = null,
  admitRead: (clientId: string | null) => boolean = () => true,
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
      // ID-3 DoS (24D-3): per-client read rate limit, on top of the queue-status
      // cadence cache. An over-rate (or muted) client collapses to the SAME
      // uniform denial — no read served, no cross-client info, no enumeration.
      if (!admitRead(session.clientId)) return rpcDenied(id);
      // ID-2 read scope (24D-2a): when the session carries a scope, the requested
      // resource must be in it. A scoped client reading out-of-scope (or an unknown
      // URI) gets the SAME uniform denial — no cross-client info, no enumeration.
      if (session.scope) {
        const descriptor = EXPOSED_RESOURCES.find(
          (resource) => resource.uri === params.data.uri,
        );
        if (!descriptor || !isReadAllowed(session.scope, descriptor.name)) {
          return rpcDenied(id);
        }
      }
      const outcome = readResourceByUri(params.data.uri, queueStatus);
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
