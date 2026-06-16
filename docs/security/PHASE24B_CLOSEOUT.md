# Phase 24B — MCP Gateway Read-Server — CLOSEOUT + FREEZE

**Frozen:** 2026-06-16.
**Scope frozen:** `src/lib/mcp-gateway/` — a local **stdio** MCP server exposing
**exactly two read-only resources** and **no mutation path**.
**Builds on:** 24B-1 `6da7ee4` (server + pipeline-view-model + GATE-2),
24B-2 `5e90c45` (queue-status + ID-1/ID-3/ID-5). Both verified present in HEAD.
**Closeout test:** `tests/mcp-gateway/phase-24b-closeout.test.ts`.
**Threat model / architecture:** `docs/security/MCP_GATEWAY_THREAT_MODEL.md`,
`docs/security/MCP_GATEWAY_ARCHITECTURE.md`. **GATE-1 recon:**
`docs/security/GATE1_RECON_FINDINGS.md` (`256048c`, Verdict A).

This is a **verification-and-freeze** slice. It adds the closeout test, this
document, and a registry banner. **It changes no gateway behavior.**

---

## 1. What 24B built (now frozen)

A hand-rolled, SDK-free JSON-RPC 2.0 server over newline-delimited stdio
(`src/lib/mcp-gateway/server.ts`). It serves three methods — `initialize`,
`resources/list`, `resources/read` — and **exposes exactly two reads**:

| Resource              | URI                               | Content                           | Controls              |
| --------------------- | --------------------------------- | --------------------------------- | --------------------- |
| `pipeline-view-model` | `jarvis://pipeline/view-model`    | static governance topology        | ID-4, sanitizer       |
| `queue-status`        | `jarvis://approvals/queue-status` | counts-only approval-queue status | ID-1, ID-3, sanitizer |

There is **no method that proposes, approves, enqueues, executes, or writes**.
Identity is checked once at connection time (fail-closed); every refusal is the
**same** uniform denial (ID-5). The server's full transitive import graph reaches
**only** the allowed read projection + schemas + the leaf queue-status projection
(GATE-2), and **no mutator tree**.

---

## 2. Read-surface invariants — re-verified against the current tree

Each invariant: the **claim**, the **source evidence** (file:line), and the
**machine-check** that holds it (existing gateway test + the new closeout test).

### 2.1 EXPOSURE CONFORMANCE — exactly {pipeline-view-model, queue-status}

- **Registry is the single source of the exposed set:** `EXPOSED_RESOURCES`
  has exactly two descriptors — `resources.ts:38` (pipeline-view-model) and the
  queue-status entry immediately after. `listExposedResourceNames()`
  (`resources.ts:58`) derives the list from it.
- **`resources/list` echoes exactly the registry** — `protocol.ts:88` maps
  `EXPOSED_RESOURCES` with no additions.
- **No third surface is reachable:** `readResourceByUri` (`resources.ts:93`)
  returns a hit **only** for the two known URIs and a miss for everything else;
  `protocol.ts:99` (`resources/read`) turns every miss into `rpcDenied`.
- **Machine-check:** `server.test.ts:146` (I-24B1-4, list == both; non-exposed
  read denied) + closeout `freeze: exposure set is exactly the two reads`.

### 2.2 STRUCTURAL NON-MUTATION — GATE-2 transitive import allowlist

- **Positive default-deny allowlist, transitive:** `ALLOW_PREFIXES`
  (`transitive-import-allowlist.test.ts:42`) = `{src/lib/mcp-gateway/,
src/lib/pipeline-visualization/}`; `EXTERNAL_ALLOW` = `{zod, node:crypto}`.
  The walk roots at `index.ts` + `server.ts` (`:253`) and recurses runtime edges
  (static + barrel re-export + dynamic literal + require).
- **Mutator trees denied on EVERY edge:** `DENY_TREES`
  (`transitive-import-allowlist.test.ts:53`) names approval-runtime, chat
  (executor), tools (runtime), db, telemetry, observability, google-adapters,
  obsidian, rollbacks, projects, project-state, memory, runtime, providers,
  router, etc. — checked even on type-only edges (you may not even _name_ one).
- **Fail-closed on the one thing a regex walk cannot prove:** a NON-LITERAL
  dynamic import throws (`transitive-import-allowlist.test.ts:111`).
- **Negative control proves the policy bites:** `transitive-import-allowlist.test.ts:316`
  asserts the real mutators (`chat/tool-approvals.ts`, `tools/runtime.ts`,
  `db/approvals.ts`, `approval-runtime/contracts.ts`) are denied + excluded, and
  that a literal mutator import would be followed (and denied).
- **Machine-check:** the four `it` blocks under `transitive-import-allowlist.test.ts:255`
  (reaches queue-status.ts; no mutator tree; all repo modules allowlisted; all
  externals allowlisted) + closeout `GATE-2: …` blocks (scoped re-walk).

### 2.3 ID-4 — pipeline-view-model is STATIC topology

- **Built from frozen module-level constants, deep-copied:**
  `buildPipelineViewModel` (`pipeline-visualization/contracts.ts:718`) reads
  `PIPELINE_STAGES` (`:304`), `PIPELINE_TRANSITIONS` (`:361`),
  `PIPELINE_BOUNDARIES` (`:452`) — all module constants — and returns a deep
  JSON clone (`copy()`, `:895`). No `Date.now()`, no env, no per-session input.
- **No affordances:** `controls: []`, `execute_affordance_present: false`,
  `approve_affordance_present: false`, `mutation_affordance_present: false`
  (`contracts.ts:769-773`).
- **The gateway sanitizes it on read:** `readPipelineViewModel`
  (`resources.ts:67`) wraps the build in `sanitizeReadPayload`.
- **Machine-check:** `server.test.ts:263` (I-24B1-6: carries none of the
  live/per-session field keys; byte-identical across two builds) + closeout
  `ID-4: view-model is static` (deterministic + no live keys).

### 2.4 ID-1 — queue-status is counts + coarse state ONLY

- **The whole response shape is five keys:** `QueueStatusSnapshot`
  (`queue-status.ts:41`) = `pending_count`, `pending_bucket`, `cadence_seconds`,
  `metadata_only:true`, `read_only:true`. Nothing per-proposal.
- **Structurally incapable of carrying a specific:** the injected source is
  typed `QueueStatusSource = () => number` (`queue-status.ts:52`) — a bare
  number — and `projectQueueStatus` (`queue-status.ts:65`) floors/clamps it into
  the five-key snapshot. Only `pending` is surfaced (no approved/denied/expired
  resolution activity).
- **Machine-check:** `queue-status.test.ts:195` (I-24B2-2: seven sensitive-laden
  pending rows seeded; snapshot is the five keys, count 7, zero sentinels leak —
  direct + stdio e2e) + closeout `ID-1: queue-status is counts-only`
  (named-field absence over a seeded queue).

### 2.5 ID-3 — coarse cadence (no sub-interval timing channel)

- **Server-side cache, server-controlled clock:** `createQueueStatusReader`
  (`queue-status.ts:93`) computes once cold, then returns the **same** cached
  snapshot for every read within `cadenceMs` (default
  `DEFAULT_QUEUE_STATUS_CADENCE_MS = 30_000`, `queue-status.ts:28`). The cadence
  and clock are constructor args, never client-settable.
- **Documented residual:** a slow, coarse pending count — bounded and disclosed
  (`cadence_seconds`), not a real-time feed (`queue-status.ts:82-92`).
- **Machine-check:** `queue-status.test.ts:355` (I-24B2-6: count frozen across
  rapid sub-30s polls though the queue jumped; moves only past the interval) +
  closeout `ID-3: cadence caching`.

### 2.6 ID-5 — uniform denial naming no surface or scope

- **One denial builder:** `rpcDenied` (`schemas.ts:59`) →
  `{ code: -32000, message: "request denied" }` (`UNIFORM_DENIAL_MESSAGE`,
  `schemas.ts:43`).
- **Every refusal collapses to it:** unauthenticated session, unknown method,
  unknown/forbidden/unwired resource, bad params — all return `rpcDenied`
  (`protocol.ts:77, 91, 99-101, 105`).
- **Machine-check:** `server.test.ts:146` (unknown method == forbidden read, same
  code+message) + `queue-status.test.ts:304` (I-24B2-5: unknown / forbidden /
  unwired queue-status indistinguishable; error names neither "queue" nor
  "approval") + closeout `ID-5: uniform denial`.

### 2.7 IDENTITY SEAM — fail-closed, server-derived id

- **Fail-closed:** `authenticateConnection` (`identity.ts:46`) refuses an absent
  or empty token (`:51`) and an unprovisioned one (`:55`).
  `loadProvisionedTokenHashesFromEnv` (`identity.ts:68`) yields an empty set when
  unset ⇒ every connection refused.
- **No client self-identification:** `clientId` is `deriveClientId` =
  `mcp-client:${sha256(token).slice(0,16)}` (`identity.ts:36`) — a function of
  the token only; there is no request field a client can use to choose it.
- **Machine-check:** `server.test.ts:189` (I-24B1-5: absent/unprovisioned
  refused; provisioned derives a stable id; client-supplied id has no effect;
  unauthenticated session uniformly denied over stdio) + closeout
  `identity seam fail-closed`.

### 2.8 SANITIZER — every read passes the leaf sentinel, fail-closed

- **Leaf, imports nothing:** `sanitizer.ts` is a zero-import module.
  `findForbiddenFields` (`sanitizer.ts:116`) walks objects/arrays for forbidden
  KEY classes and url/path/secret VALUE patterns; `sanitizeReadPayload`
  (`sanitizer.ts:155`) returns a JSON-safe clone **only** if clean, else throws
  (does not emit a partially-redacted response).
- **Both reads pass through it:** `readPipelineViewModel` (`resources.ts:80`) and
  the queue-status branch of `readResourceByUri` (`resources.ts:93`) both wrap
  their payload in `sanitizeReadPayload`.
- **Machine-check:** `server.test.ts:114` (I-24B1-2: clean view-model; planted
  payload/url/path/secret tripped) + `queue-status.test.ts:258` (I-24B2-3: clean
  across buckets) + closeout `sanitizer fail-closed`.

---

## 3. The frozen boundary is untouched

24B is **additive** and confined to the gateway. Evidence:

- **Both 24B commits touched only `src/lib/mcp-gateway/`:** `git show --stat
6da7ee4` (9 files, all `src/lib/mcp-gateway/`) and `git show --stat 5e90c45`
  (8 files, all `src/lib/mcp-gateway/`). No Phase-18 lifecycle, proposal
  contract, pipeline spine, 21B adapter, or frozen test was modified.
- **Zero new `runtime.runTool` call sites.** The production executor call sites
  remain exactly **two**, both in the frozen `chat/` tree and **none** in the
  gateway:
  - `src/lib/chat/tool-approvals.ts:350`
  - `src/lib/chat/tool-continuation.ts:238`
    The gateway directory contains **no** `runTool` reference. (Closeout asserts
    the gateway is `runTool`-free and that the production count is 2.)
- **The Phase-18 executor/decision point is unchanged:** `resumeApproval` lives
  at `tool-approvals.ts:243-369`; the human-decision/pre-execution gate sits
  between the non-granted block (`:315-339`) and `runtime.runTool` (`:350`) —
  the same shape GATE-1 recorded.

---

## 4. Closeout invariants (asserted by the closeout test)

- **I-24B3-1** exposure set == {pipeline-view-model, queue-status}, frozen.
- **I-24B3-2** GATE-2 transitive allowlist holds; no mutator tree reachable.
- **I-24B3-3** view-model static (ID-4); queue-status counts-only (ID-1).
- **I-24B3-4** ID-3 cadence + ID-5 uniform denial + identity seam fail-closed.
- **I-24B3-5** zero new `runtime.runTool` call sites; frozen boundary untouched.

The closeout test is written as **many small focused `it` blocks** (no
whole-repo scan inside one `it`, per the E-013/E-015 lesson). The GATE-2 check is
a **scoped** transitive walk rooted at the gateway (≈12 files), not a repo scan.

---

## 5. What 24C inherits (start here)

24C adds the **proposal constructor + enqueue boundary** — the first write-path
slice. It inherits a known base:

### 5.1 The FC-2 insertion spec (from GATE-1, `256048c`)

- **Exact guard insertion point:** `src/lib/chat/tool-approvals.ts:341` — i.e.
  **after** the non-granted block (`:315-339`, which returns on
  denied/expired/cancelled/replayed) and **before** `runtime.runTool` (`:350`).
  This is the sole executor (`resumeApproval`, `:243-369`); guarding here gates
  every execution.
- **Additive proposal-contract fields (18A contract — `z.strictObject`, so
  additive-optional only):**
  - `canonical_effect_hash: z.string().trim().regex(/^hash:[a-z0-9._:-]+$/).optional()`
    (GATE-1 findings `:266`)
  - `scope_snapshot_ref_hash: z.string().trim().regex(/^hash:[a-z0-9._:-]+$/).optional()`
    (`:267`)
  - `expires_at_ms` — **already exists** (`contracts.ts:65`); reuse for
    `not-expired`, add nothing (`:269`).
- **Additive DB columns (`schema.ts:616-654` migration block):**
  `canonical_effect_hash TEXT`, `scope_snapshot_hash TEXT` — set at proposal
  creation, re-read by the FC-2 guard. `scope_hash` is already carried.

### 5.2 The narrow-projection / injected-source template (from 24B-2)

When a slice needs data from a **denied** tree, do **not** import the tree.
Inject a **minimal typed value** and project it inside an allowed leaf — exactly
as queue-status does: `QueueStatusSource = () => number` (`queue-status.ts:52`)
is wired by the host **outside** the gateway graph, so GATE-2 stays green with
**no allowlist relaxation**. This is the template for 24C reading any
proposal/queue datum it must not import.

### 5.3 The structural controls 24C must EXTEND (and only minimally)

- **The transitive allowlist (GATE-2):** 24C will add the proposal constructor +
  enqueue boundary to `ALLOW_PREFIXES` — **and only those** — per the GATE-5
  "needle's eye". Every other mutator tree stays denied. The negative control
  must keep biting.
- **The leaf sanitizer:** any new read 24C exposes passes
  `sanitizeReadPayload`; any new forbidden field class is added to the leaf
  `FORBIDDEN_KEY_LIST` (`sanitizer.ts:16`), which imports nothing.
- **ID-0 default-NEVER:** the exposed set is frozen at **two reads**. Adding a
  third requires an explicit exposure-matrix amendment + a new slice.

### 5.4 The five 24A close-gates (status)

- **GATE-1** — can FC-2 wrap the frozen Phase-18 lifecycle additively?
  **PASS** (`256048c`, Verdict A).
- **GATE-2** — transitive import allowlist (structural non-mutation). **BUILT**
  (24B-1; re-verified here).
- **GATE-3** — canonical effect hash is un-forgeable. **OPEN** (24C).
- **GATE-4** — human-session marker (the decision is a human's). **OPEN** (24C/24D).
- **GATE-5** — enqueue "needle's eye": the only widening of the allowlist is the
  proposal constructor + enqueue boundary. **OPEN** (24C).

---

## 6. Freeze declaration

**Phase 24B (MCP gateway read-server) is FROZEN as of 2026-06-16.** The read
surface is **exactly two reads** — `pipeline-view-model` and `queue-status`. No
mutation path exists. Further change to this frozen surface — including any third
exposed read — requires a new registry entry above the banner first
(`docs/enhancements/REGISTRY.md`).
