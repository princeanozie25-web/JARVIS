# Runbook — hosting the stdio MCP gateway (E-045, Phase 25B)

The Phase 24 gateway is a frozen, read-only, stdio-only JSON-RPC server
(`initialize` / `resources/list` / `resources/read`; everything else is a uniform
denial). Nothing runs it until a **host** injects its seams. `scripts/mcp-gateway-host.ts`
is that host. Loopback stdio only — no HTTP, no socket, no network.

## 1. Provision a client (hashes only — the host never sees plaintext)

```bash
TOK="tok_$(head -c 24 /dev/urandom | xxd -p)"          # give THIS to the client, once
HASH=$(printf "%s" "$TOK" | shasum -a 256 | cut -d' ' -f1)
```

Put the registry in `.env.local` (one JSON object, keyed by sha256 of the token):

```
JARVIS_MCP_CLIENT_REGISTRY={"<HASH>":{"client_id":"claude-desktop","enabled":true,"scope":{"read":["queue-status"],"propose":[]}}}
```

- `scope.read` is the ID-2 read grant. **An entry without a scope authenticates but
  can read nothing** (fail-closed) — this is by design, not a bug.
- `scope.propose` grants are for the library-only propose path (not on the stdio wire).
- Revoke: set `"enabled": false` (or remove the entry) and restart the host.
- Rotate: add the new hash with `"rotated_from_hash": "<old>"`, disable the old one.

## 2. Run it

```bash
npx tsx scripts/mcp-gateway-host.ts --probe     # prints injected seam values, exits
npx tsx scripts/mcp-gateway-host.ts             # serves JSON-RPC on stdin/stdout
```

The **client** spawns the host with its token in the spawn env: `JARVIS_MCP_TOKEN=$TOK`.
For a desktop MCP client, the server entry is `npx tsx scripts/mcp-gateway-host.ts`
with `cwd` = the repo and `env.JARVIS_MCP_TOKEN` set. The host logs to stderr only.

## 3. What the host injects (all outside the gateway import graph, GATE-2)

| seam                    | source                                                                                                         | notes                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `clientRegistry`        | `JARVIS_MCP_CLIENT_REGISTRY`                                                                                   | FC-3 identity; hashes only                            |
| `queueStatusSource`     | app DB: `COUNT(pending, unexpired)`                                                                            | read-only; the gateway sees a number                  |
| `pendingCountForClient` | app DB: pending by `client_id`                                                                                 | 24D-3 queue-depth cap                                 |
| `clientMuteStore`       | `data/mcp-gateway/mutes.json`                                                                                  | durable; a human writes it, the gateway only reads it |
| `recordLastUsed`        | `data/mcp-gateway/last-used.json`                                                                              | token-lifecycle hygiene (id + timestamp only)         |
| `admissionLimits`       | `JARVIS_MCP_STANDING_QUOTA_MAX/PER_MS`, `JARVIS_MCP_READ_RATE_MAX/PER_MS`, `JARVIS_MCP_MAX_PENDING_PER_CLIENT` | gateway defaults when unset                           |
| `queueStatusCadenceMs`  | `JARVIS_MCP_QUEUE_STATUS_CADENCE_MS`                                                                           | ID-3 server-controlled cadence                        |

Override the data dir with `JARVIS_MCP_HOST_DATA_DIR`.

## 4. Mute / unmute a client (operator action)

Edit `data/mcp-gateway/mutes.json` — `{"<client_id>": {"reason": "...", "at_ms": 0}}` — and
restart the host, or remove the key to unmute. A muted client gets the uniform denial on
every read; nothing about the mute leaks to it.

## 5. Verify (what "live" looks like)

```
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{"name":"jarvis-mcp-gateway",...}}}
{"jsonrpc":"2.0","id":2,"result":{"contents":[{"uri":"jarvis://approvals/queue-status","mimeType":"application/json","text":"{...\"bucket\":...}"}]}}
```

An unprovisioned, disabled, unscoped or muted client — and any method outside the read
surface (`tools/call`) — returns `{"error":{"code":-32000,"message":"request denied"}}`.
