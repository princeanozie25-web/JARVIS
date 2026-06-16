// MCP gateway — local stdio transport wire.
//
// stdio ONLY: newline-delimited JSON-RPC over a readable/writable pair
// (defaulting to process.stdin/stdout). No HTTP, no SSE, no socket, no network
// listener. Identity is checked at connection time (fail-closed); the session
// is then frozen for the connection. NOTHING runs at import time — the server
// starts only when startStdioServer() is called (so importing this module, e.g.
// for the GATE-2 allowlist walk or tests, has no side effects).
//
// Stream types use the ambient NodeJS.{Readable,Writable}Stream globals, so this
// module imports no node builtin (keeps the GATE-2 import graph minimal).
//
// The queue-status counts source (24B-2) is INJECTED: the caller supplies a
// `() => number` that reads the approvals count from OUTSIDE the gateway's
// import graph. The server wraps it in the cadence-cached reader and hands that
// to the handler. When no source is given, queue-status reads are denied (the
// gateway never imports the approvals/db tree itself — GATE-2).

import {
  authenticateConnection,
  loadProvisionedTokenHashesFromEnv,
  type ConnectionAuthResult,
} from "./identity";
import {
  authenticateClient,
  type ClientAuthResult,
  type ProvisionedClientRegistry,
  type RecordLastUsed,
} from "./client-registry";
import { handleJsonRpcRequest, type GatewaySession } from "./protocol";
import {
  createQueueStatusReader,
  type QueueStatusReader,
  type QueueStatusSource,
} from "./queue-status";
import { rpcInvalidRequest } from "./schemas";

export interface StartStdioServerOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  /** Presented out-of-band (spawn env), never from a request body. */
  presentedToken?: string | null;
  /** Human-provisioned allowlist (token hashes), also out-of-band. 24B-1 seam. */
  provisionedTokenHashes?: ReadonlySet<string>;
  /** FC-3 (24D-1): the human-provisioned client registry (token_hash -> client).
   * Built by the host from the env-carried source (parseClientRegistryFromEnv),
   * OUTSIDE the gateway import graph. When supplied, it is the FC-3 auth path. */
  clientRegistry?: ProvisionedClientRegistry;
  /** Injected last-used recorder (host -> db/file), keyed by client_id. */
  recordLastUsed?: RecordLastUsed;
  /** Injected raw pending-count source. Reads the approvals count OUTSIDE the
   * gateway import graph. Absent => queue-status reads are denied. */
  queueStatusSource?: QueueStatusSource;
  /** ID-3 cadence for the queue-status count cache (server-controlled). */
  queueStatusCadenceMs?: number;
  /** Injectable clock (tests); defaults to Date.now via the reader. */
  now?: () => number;
}

export interface RunningStdioServer {
  authenticated: boolean;
  clientId: string | null;
  stop(): void;
}

export function startStdioServer(
  options: StartStdioServerOptions = {},
): RunningStdioServer {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const presentedToken =
    options.presentedToken ?? process.env.JARVIS_MCP_TOKEN ?? null;

  // Auth: FC-3 client registry (24D-1) when the host supplies one; otherwise the
  // 24B-1 hash-Set seam (backward-compat). Identity is ALWAYS server-derived; an
  // absent/unprovisioned/disabled token is refused (fail-closed). The token is
  // presented out-of-band and never read from a request body.
  let auth: ClientAuthResult | ConnectionAuthResult;
  if (options.clientRegistry !== undefined) {
    auth = authenticateClient({
      presentedToken,
      registry: options.clientRegistry,
      recordLastUsed: options.recordLastUsed,
      now: options.now,
    });
  } else {
    const provisionedTokenHashes =
      options.provisionedTokenHashes ?? loadProvisionedTokenHashesFromEnv();
    auth = authenticateConnection({ presentedToken, provisionedTokenHashes });
  }
  const session: GatewaySession = auth.ok
    ? {
        authenticated: true,
        clientId: auth.clientId,
        // FC-3 auth carries the client's scope (24D-2a); the legacy seam does not.
        scope: "scope" in auth ? auth.scope : undefined,
      }
    : { authenticated: false, clientId: null };

  // Build the queue-status reader only when a counts source was injected. The
  // cadence + clock are server-controlled, never client-settable.
  const queueStatusReader: QueueStatusReader | null =
    options.queueStatusSource !== undefined
      ? createQueueStatusReader({
          source: options.queueStatusSource,
          cadenceMs: options.queueStatusCadenceMs,
          now: options.now,
        })
      : null;

  const write = (value: unknown): void => {
    output.write(`${JSON.stringify(value)}\n`);
  };

  const handleLine = (line: string): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      write(rpcInvalidRequest(null));
      return;
    }
    const response = handleJsonRpcRequest(parsed, session, queueStatusReader);
    if (response !== null) write(response);
  };

  let buffer = "";
  const onData = (chunk: Buffer | string): void => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) handleLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  };

  if (typeof input.setEncoding === "function") input.setEncoding("utf8");
  input.on("data", onData);

  return {
    authenticated: session.authenticated,
    clientId: session.clientId,
    stop(): void {
      if (typeof input.off === "function") input.off("data", onData);
      else input.removeListener("data", onData);
    },
  };
}
