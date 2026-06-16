// MCP gateway invariants I-24B1-1, -2, -4, -5, -6 (I-24B1-3 is GATE-2, in
// transitive-import-allowlist.test.ts).

import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";

import {
  EXPOSED_RESOURCES,
  PIPELINE_VIEW_MODEL_URI,
  authenticateConnection,
  deriveClientId,
  findForbiddenFields,
  handleJsonRpcRequest,
  hashToken,
  listExposedResourceNames,
  readPipelineViewModel,
  startStdioServer,
  UNIFORM_DENIAL_MESSAGE,
  type GatewaySession,
} from "./index";

const TOKEN = "provisioned-test-token-0001";
const PROVISIONED = new Set<string>([hashToken(TOKEN)]);

function collect(
  stream: PassThrough,
  count: number,
  timeoutMs = 3000,
): Promise<unknown[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    const responses: unknown[] = [];
    let buffer = "";
    stream.setEncoding("utf8");
    const timer = setTimeout(
      () =>
        rejectPromise(
          new Error(
            `timed out waiting for ${count} responses (got ${responses.length})`,
          ),
        ),
      timeoutMs,
    );
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line.length > 0) responses.push(JSON.parse(line));
        index = buffer.indexOf("\n");
      }
      if (responses.length >= count) {
        clearTimeout(timer);
        resolvePromise(responses);
      }
    });
  });
}

// Loose structural view of a JSON-RPC response for test assertions (no `any`).
interface GatewayResp {
  result: {
    serverInfo: { name: string };
    contents: Array<{ uri: string; mimeType: string; text: string }>;
    resources: Array<{ name: string }>;
  };
  error: { code: number; message: string };
}

const AUTHED: GatewaySession = {
  authenticated: true,
  clientId: "mcp-client:test",
};
const UNAUTHED: GatewaySession = { authenticated: false, clientId: null };

// ---------------------------------------------------------------------------
// I-24B1-1 — transport: the server serves the pipeline view-model over stdio
// ---------------------------------------------------------------------------
describe("I-24B1-1 (transport): stdio serves the pipeline-view-model read", () => {
  it("a client read over stdio returns the view-model", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const pending = collect(output, 2);
    const server = startStdioServer({
      input,
      output,
      presentedToken: TOKEN,
      provisionedTokenHashes: PROVISIONED,
    });
    expect(server.authenticated).toBe(true);

    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`,
    );
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: PIPELINE_VIEW_MODEL_URI } })}\n`,
    );

    const [initResp, readResp] = (await pending) as GatewayResp[];
    expect(initResp.result.serverInfo.name).toBe("jarvis-mcp-gateway");
    const contents = readResp.result.contents;
    expect(Array.isArray(contents)).toBe(true);
    const viewModel = JSON.parse(contents[0].text);
    expect(viewModel.title).toBe("Governed Pipeline");
    expect(viewModel.stages.length).toBe(6);
    expect(viewModel.read_only).toBe(true);
    server.stop();
  });
});

// ---------------------------------------------------------------------------
// I-24B1-2 — sanitized: the read carries no raw payload / forbidden field
// ---------------------------------------------------------------------------
describe("I-24B1-2 (sanitized): the read passes the sanitizer; no forbidden field", () => {
  it("the forbidden-field sentinel finds nothing on the exposed view-model", () => {
    const viewModel = readPipelineViewModel();
    expect(findForbiddenFields(viewModel)).toEqual([]);
  });

  it("the sentinel catches a planted raw payload / url / path / secret (control)", () => {
    expect(findForbiddenFields({ transcript: "hello" }).length).toBeGreaterThan(
      0,
    );
    expect(
      findForbiddenFields({ note: "https://evil.example/x" }).length,
    ).toBeGreaterThan(0);
    expect(
      findForbiddenFields({ note: "/home/prince/secrets/key.txt" }).length,
    ).toBeGreaterThan(0);
    expect(findForbiddenFields({ apiKey: "x" }).length).toBeGreaterThan(0);
    // and a benign prose description that merely mentions the words does NOT trip
    expect(
      findForbiddenFields({
        description:
          "Input arrives as text, voice transcript draft, or supplied metadata.",
      }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// I-24B1-4 — exposure conformance: EXACTLY the pipeline-view-model, nothing else
// ---------------------------------------------------------------------------
describe("I-24B1-4 (exposure conformance): the exposed set == {pipeline-view-model}", () => {
  it("exposes exactly one resource", () => {
    expect(listExposedResourceNames()).toEqual(["pipeline-view-model"]);
    expect(EXPOSED_RESOURCES.length).toBe(1);
  });

  it("resources/list returns exactly that one; a non-exposed read is uniformly denied", () => {
    const list = handleJsonRpcRequest(
      { jsonrpc: "2.0", id: 1, method: "resources/list" },
      AUTHED,
    ) as GatewayResp;
    expect(list.result.resources.map((r: { name: string }) => r.name)).toEqual([
      "pipeline-view-model",
    ]);

    const denied = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "jarvis://telemetry/event-store" },
      },
      AUTHED,
    ) as GatewayResp;
    expect(denied.error.message).toBe(UNIFORM_DENIAL_MESSAGE);

    // unknown method is denied with the SAME message (no surface enumeration, ID-5)
    const unknown = handleJsonRpcRequest(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: {} },
      AUTHED,
    ) as GatewayResp;
    expect(unknown.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
    expect(unknown.error.code).toBe(denied.error.code);
  });
});

// ---------------------------------------------------------------------------
// I-24B1-5 — identity seam, fail-closed
// ---------------------------------------------------------------------------
describe("I-24B1-5 (identity, fail-closed): absent/unprovisioned token refused; client cannot self-identify", () => {
  it("refuses an absent token", () => {
    expect(
      authenticateConnection({
        presentedToken: null,
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
    expect(
      authenticateConnection({
        presentedToken: "",
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
  });

  it("refuses an unprovisioned (off-allowlist) token", () => {
    expect(
      authenticateConnection({
        presentedToken: "not-provisioned",
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
  });

  it("accepts a provisioned token and derives client_id server-side (stable, client cannot choose it)", () => {
    const a = authenticateConnection({
      presentedToken: TOKEN,
      provisionedTokenHashes: PROVISIONED,
    });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.clientId).toBe(deriveClientId(TOKEN));
    // identity is a function of the token only — there is no input by which a
    // client could supply its own id.
    expect(deriveClientId(TOKEN)).toBe(deriveClientId(TOKEN));
  });

  it("an unauthenticated session is uniformly denied every read (over stdio)", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const pending = collect(output, 1);
    const server = startStdioServer({
      input,
      output,
      presentedToken: null,
      provisionedTokenHashes: PROVISIONED,
    });
    expect(server.authenticated).toBe(false);
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: PIPELINE_VIEW_MODEL_URI } })}\n`,
    );
    const [resp] = (await pending) as GatewayResp[];
    expect(resp.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
    server.stop();
  });

  it("a client-supplied client_id in params has no effect (handler never reads it)", () => {
    const resp = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { client_id: "attacker-chosen" } },
      },
      AUTHED,
    ) as GatewayResp;
    // the response carries no client-chosen identity; server identity is derived upstream
    expect(JSON.stringify(resp)).not.toContain("attacker-chosen");
  });
});

// ---------------------------------------------------------------------------
// I-24B1-6 — static view-model (ID-4): topology only, no live/per-session fields
// ---------------------------------------------------------------------------
describe("I-24B1-6 (ID-4): the exposed view-model is static topology, no live fields", () => {
  const LIVE_FIELD_KEYS = new Set<string>([
    "providerstatus",
    "provider",
    "currentroute",
    "route",
    "recentfailures",
    "failures",
    "activeclients",
    "activeclient",
    "clients",
    "clientid",
    "pendingphase",
    "modelhealth",
    "health",
    "cost",
    "latency",
    "latencyms",
    "timestamp",
    "updatedat",
    "lastused",
    "sessionid",
    "session",
    "now",
    "uptime",
    "queuedepth",
    "pendingcount",
  ]);
  const normalize = (key: string): string =>
    key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  function collectKeys(
    value: unknown,
    out: Set<string> = new Set(),
  ): Set<string> {
    if (Array.isArray(value)) {
      value.forEach((item) => collectKeys(item, out));
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        out.add(normalize(key));
        collectKeys(child, out);
      }
    }
    return out;
  }

  it("carries none of the live/per-session field keys", () => {
    const keys = collectKeys(readPipelineViewModel());
    const offenders = [...keys].filter((key) => LIVE_FIELD_KEYS.has(key));
    expect(
      offenders,
      `live field keys present: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("is deterministic across builds (static topology, not a live snapshot)", () => {
    expect(JSON.stringify(readPipelineViewModel())).toBe(
      JSON.stringify(readPipelineViewModel()),
    );
  });
});

// keep the unauthenticated session shape referenced (documents the fail-closed default)
void UNAUTHED;
