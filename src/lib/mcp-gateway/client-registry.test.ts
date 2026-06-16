// FC-3 identity + token lifecycle invariants I-24D1-1 .. I-24D1-8 (24D-1).
//
// All tokens here are throwaway in-test fixtures (clearly fake) — NO real secret.
// The central guarantee (I-24D1-4) plants a sentinel token and proves it (and its
// hash) appear in NO emitted string across auth success AND failure.

import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authenticateClient,
  CLIENT_REGISTRY_ENV_VAR,
  hashToken,
  isStructurallyValidToken,
  parseClientRegistryFromEnv,
  startStdioServer,
  UNIFORM_DENIAL_MESSAGE,
  type ProvisionedClient,
  type ProvisionedClientRegistry,
} from "./index";

function registryFor(
  token: string,
  clientId: string,
  overrides: Partial<ProvisionedClient> = {},
): ProvisionedClientRegistry {
  return new Map([
    [
      hashToken(token),
      {
        client_id: clientId,
        enabled: true,
        created_at_ms: 1_000,
        rotated_from_hash: null,
        ...overrides,
      },
    ],
  ]);
}

function collect(stream: PassThrough, count: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let buffer = "";
    let lines = 0;
    const timer = setTimeout(() => reject(new Error("timed out")), 3000);
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      lines = buffer.split("\n").filter((l) => l.trim().length > 0).length;
      if (lines >= count) {
        clearTimeout(timer);
        resolvePromise(buffer);
      }
    });
  });
}

const SELF_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "client-registry.ts"),
  "utf8",
);
// comment-stripped, for import/edge assertions (prose legitimately NAMES denied
// trees, e.g. "no approval-runtime"; what matters is no CODE edge to one)
const SELF_CODE = SELF_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /(^|\n)\s*\/\/[^\n]*/g,
  "",
);

const TOKEN = "throwaway-token-alpha-00000001";

// ===========================================================================
// I-24D1-1 — token -> identity (FC-3)
// ===========================================================================
describe("I-24D1-1 (FC-3 token->identity): client_id derived from the token hash", () => {
  it("a provisioned token authenticates with the registry's server-assigned client_id", () => {
    const reg = registryFor(TOKEN, "mcp-client:alpha");
    expect(
      authenticateClient({ presentedToken: TOKEN, registry: reg }),
    ).toEqual({ ok: true, clientId: "mcp-client:alpha" });
  });

  it("identity is keyed by the token HASH — a different token cannot reach that identity", () => {
    const reg = registryFor(TOKEN, "mcp-client:alpha");
    const other = authenticateClient({
      presentedToken: "throwaway-token-beta-00000002",
      registry: reg,
    });
    expect(other.ok).toBe(false);
    // there is no input field by which a client could supply client_id: the only
    // inputs are presentedToken + the server-held registry.
  });
});

// ===========================================================================
// I-24D1-2 — allowlist + disabled
// ===========================================================================
describe("I-24D1-2 (allowlist): unprovisioned or disabled clients are refused", () => {
  it("a structurally-valid token whose hash is not provisioned is refused", () => {
    const reg = registryFor(TOKEN, "mcp-client:alpha");
    expect(
      authenticateClient({
        presentedToken: "throwaway-token-unknown-9999",
        registry: reg,
      }),
    ).toEqual({ ok: false, reason: "not_provisioned" });
  });

  it("a provisioned but disabled client is refused", () => {
    const reg = registryFor(TOKEN, "mcp-client:alpha", { enabled: false });
    expect(
      authenticateClient({ presentedToken: TOKEN, registry: reg }),
    ).toEqual({ ok: false, reason: "disabled" });
  });
});

// ===========================================================================
// I-24D1-3 — anonymous / malformed refused (fail-closed)
// ===========================================================================
describe("I-24D1-3 (anonymous refused): no/empty/malformed token is refused", () => {
  const reg = registryFor(TOKEN, "mcp-client:alpha");

  it("absent / empty / whitespace tokens are refused", () => {
    for (const t of [null, undefined, "", "   "]) {
      expect(authenticateClient({ presentedToken: t, registry: reg })).toEqual({
        ok: false,
        reason: "absent_token",
      });
    }
  });

  it("malformed tokens (too short, spaces, control chars) are refused", () => {
    const withNul = `valid-prefix${String.fromCharCode(0)}suffix-1234567`;
    for (const t of ["abc", "short-token", "has spaces here too", withNul]) {
      expect(authenticateClient({ presentedToken: t, registry: reg })).toEqual({
        ok: false,
        reason: "malformed_token",
      });
    }
    expect(isStructurallyValidToken(TOKEN)).toBe(true);
    expect(isStructurallyValidToken("abc")).toBe(false);
  });
});

// ===========================================================================
// I-24D1-4 — NEVER LOGGED (the central guarantee)
// ===========================================================================
describe("I-24D1-4 (never logged): the token + its hash appear in no emitted string", () => {
  const SENTINEL = "SENTINEL-do-not-log-abcdefABCDEF0123456789";
  const sentinelHash = hashToken(SENTINEL);
  const reg = registryFor(SENTINEL, "mcp-client:sentinel");

  it("auth success AND failure result objects never contain the token or hash", () => {
    const ok = authenticateClient({ presentedToken: SENTINEL, registry: reg });
    const bad = authenticateClient({
      presentedToken: "throwaway-token-wrong-0000",
      registry: reg,
    });
    for (const res of [ok, bad]) {
      const s = JSON.stringify(res);
      expect(s).not.toContain(SENTINEL);
      expect(s).not.toContain(sentinelHash);
    }
  });

  it("over stdio: no output / last-used record contains the token or hash; denial is uniform", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const lastUsed: Array<[string, number]> = [];

    const server = startStdioServer({
      input,
      output,
      presentedToken: SENTINEL,
      clientRegistry: reg,
      recordLastUsed: (clientId, at) => lastUsed.push([clientId, at]),
    });
    expect(server.authenticated).toBe(true);
    expect(server.clientId).toBe("mcp-client:sentinel");

    const pending = collect(output, 2); // attach BEFORE writing (no data race)
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`,
    );
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "jarvis://telemetry/x" } })}\n`,
    );
    const all = await pending;
    server.stop();

    expect(all).not.toContain(SENTINEL);
    expect(all).not.toContain(sentinelHash);
    expect(all).toContain(UNIFORM_DENIAL_MESSAGE); // the denied read is uniform

    // last-used recorded the client_id only — never the token/hash
    expect(lastUsed.length).toBeGreaterThan(0);
    for (const [clientId] of lastUsed) {
      expect(clientId).toBe("mcp-client:sentinel");
    }
  });

  it("over stdio: a REFUSED (unprovisioned) token leaks nothing and is uniformly denied", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = startStdioServer({
      input,
      output,
      presentedToken: "throwaway-token-attacker-0001",
      clientRegistry: reg,
    });
    expect(server.authenticated).toBe(false);
    const pending = collect(output, 1); // attach BEFORE writing
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "jarvis://pipeline/view-model" } })}\n`,
    );
    const out = await pending;
    server.stop();
    expect(out).not.toContain("throwaway-token-attacker-0001");
    expect(out).toContain(UNIFORM_DENIAL_MESSAGE);
  });
});

// ===========================================================================
// I-24D1-5 — last-used via injected store; no db import
// ===========================================================================
describe("I-24D1-5 (last-used): recorded via the injected store, keyed by client_id", () => {
  it("a successful auth records (client_id, now); a refused auth records nothing", () => {
    const reg = registryFor(TOKEN, "mcp-client:alpha");
    const recorded: Array<[string, number]> = [];
    const record = (clientId: string, at: number): void => {
      recorded.push([clientId, at]);
    };

    authenticateClient({
      presentedToken: TOKEN,
      registry: reg,
      recordLastUsed: record,
      now: () => 12_345,
    });
    expect(recorded).toEqual([["mcp-client:alpha", 12_345]]);

    authenticateClient({
      presentedToken: "throwaway-token-unknown-9999",
      registry: reg,
      recordLastUsed: record,
      now: () => 99_999,
    });
    expect(recorded).toEqual([["mcp-client:alpha", 12_345]]); // unchanged
  });

  it("the module imports no db/approval-runtime tree (only node:crypto + ./identity)", () => {
    const froms = [...SELF_CODE.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect([...new Set(froms)].sort()).toEqual(["./identity", "node:crypto"]);
  });
});

// ===========================================================================
// I-24D1-6 — revocation
// ===========================================================================
describe("I-24D1-6 (revocation): a previously-valid client is refused once disabled", () => {
  it("enabled -> ok; the same hash disabled -> refused", () => {
    expect(
      authenticateClient({
        presentedToken: TOKEN,
        registry: registryFor(TOKEN, "mcp-client:alpha", { enabled: true }),
      }).ok,
    ).toBe(true);
    expect(
      authenticateClient({
        presentedToken: TOKEN,
        registry: registryFor(TOKEN, "mcp-client:alpha", { enabled: false }),
      }),
    ).toEqual({ ok: false, reason: "disabled" });
  });
});

// ===========================================================================
// I-24D1-7 — repo cleanliness + env provisioning
// ===========================================================================
describe("I-24D1-7 (repo cleanliness): empty default, no committed hash, env-loaded", () => {
  it("the default registry (no env) is EMPTY => refuse-all (fail-closed)", () => {
    expect(parseClientRegistryFromEnv({}).size).toBe(0);
    expect(
      authenticateClient({
        presentedToken: TOKEN,
        registry: parseClientRegistryFromEnv({}),
      }),
    ).toEqual({ ok: false, reason: "not_provisioned" });
  });

  it("the committed auth module contains no token and no 64-hex hash literal", () => {
    expect(/[a-f0-9]{64}/.test(SELF_SRC)).toBe(false);
  });

  it("the registry loads from the env-carried source (hashes only)", () => {
    const env = {
      [CLIENT_REGISTRY_ENV_VAR]: JSON.stringify({
        [hashToken(TOKEN)]: {
          client_id: "mcp-client:alpha",
          enabled: true,
          created_at_ms: 1,
        },
      }),
    };
    const reg = parseClientRegistryFromEnv(env);
    expect(reg.get(hashToken(TOKEN))?.client_id).toBe("mcp-client:alpha");
    expect(
      authenticateClient({ presentedToken: TOKEN, registry: reg }).ok,
    ).toBe(true);
  });

  it("malformed/array/empty env => empty registry (fail-closed)", () => {
    expect(
      parseClientRegistryFromEnv({ [CLIENT_REGISTRY_ENV_VAR]: "not json" })
        .size,
    ).toBe(0);
    expect(
      parseClientRegistryFromEnv({ [CLIENT_REGISTRY_ENV_VAR]: "[]" }).size,
    ).toBe(0);
    expect(
      parseClientRegistryFromEnv({ [CLIENT_REGISTRY_ENV_VAR]: "" }).size,
    ).toBe(0);
  });

  it("env parser: invalid hash keys + missing client_id are dropped; enabled defaults true", () => {
    const env = {
      [CLIENT_REGISTRY_ENV_VAR]: JSON.stringify({
        "not-a-hash": { client_id: "x" },
        [hashToken(TOKEN)]: { client_id: "mcp-client:alpha" }, // no enabled -> true
        [hashToken("throwaway-token-gamma-0003")]: { enabled: true }, // no client_id -> dropped
      }),
    };
    const reg = parseClientRegistryFromEnv(env);
    expect(reg.size).toBe(1);
    expect(reg.get(hashToken(TOKEN))?.enabled).toBe(true);
  });
});

// ===========================================================================
// I-24D1-8 — GATE-2 leaf (full transitive walk is in transitive-import-allowlist.test.ts)
// ===========================================================================
describe("I-24D1-8 (GATE-2 leaf): the token auth module references no mutator tree", () => {
  it("references no db/approval-runtime/tools/chat/router tree", () => {
    for (const denied of [
      "lib/db",
      "approval-runtime",
      "lib/tools",
      "lib/chat",
      "lib/router",
    ]) {
      expect(SELF_CODE.includes(denied)).toBe(false);
    }
  });
});
