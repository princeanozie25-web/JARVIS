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

import {
  authenticateConnection,
  loadProvisionedTokenHashesFromEnv,
} from "./identity";
import { handleJsonRpcRequest, type GatewaySession } from "./protocol";
import { rpcInvalidRequest } from "./schemas";

export interface StartStdioServerOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  /** Presented out-of-band (spawn env), never from a request body. */
  presentedToken?: string | null;
  /** Human-provisioned allowlist (token hashes), also out-of-band. */
  provisionedTokenHashes?: ReadonlySet<string>;
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
  const provisionedTokenHashes =
    options.provisionedTokenHashes ?? loadProvisionedTokenHashesFromEnv();
  const presentedToken =
    options.presentedToken ?? process.env.JARVIS_MCP_TOKEN ?? null;

  const auth = authenticateConnection({
    presentedToken,
    provisionedTokenHashes,
  });
  const session: GatewaySession = auth.ok
    ? { authenticated: true, clientId: auth.clientId }
    : { authenticated: false, clientId: null };

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
    const response = handleJsonRpcRequest(parsed, session);
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
