# GATE-1 Recon — Can FC-2 wrap the frozen Phase 18 approval lifecycle additively?

**Phase 24B · slice 24B-0 · GATE-1 (read-only investigation; may STOP Phase 24).**
**Verdict: A — WRAPS CLEANLY (GATE-1 PASS).**

This document is the deliverable. It is a written verdict + the file:line evidence
behind it + the 24C insertion spec (as a SPEC, not code). No implementation code,
schema, or test was written or modified in this slice; nothing in the Phase 18
lifecycle, the proposal contract, or any frozen file was touched. Worktree:
`jarvis-main` @ `main` (HEAD `439bed28`).

---

## The exact question

> Can a server-derived, hash-frozen canonical proposal be carried through the
> existing Phase 18 approval lifecycle, and can a re-validation check (not-expired,
> scope-still-valid, client-still-active, tool-still-allowed, target-still-allowed,
> hash-unchanged) be inserted at the human-decision point, WITHOUT adding a new
> lifecycle state, altering an existing state's meaning, or modifying any frozen
> state transition?

**Answer: Yes (Verdict A).** FC-2 is expressible as (a) additive OPTIONAL fields on
the proposal contract, (b) an additional GUARD inserted at the existing
human-decision point in `resumeApproval` immediately before execution, reusing the
EXISTING non-granted → terminal-`DENIED` outcome on failure, and (c) the frozen
hash/snapshot carried on additive OPTIONAL columns of the `approvals` row via the
codebase's established idempotent `ADD COLUMN` migration. No new lifecycle state, no
altered state meaning, no modified transition, and **no frozen test must be reshaped**.

---

## 0. A structural fact that frames everything: there are TWO "approval lifecycles"

The codebase contains two distinct subsystems that both speak of "approval lifecycle".
GATE-1 only makes sense once they are separated:

|                                              | EXECUTOR (the real Phase 18 lifecycle `resumeApproval` drives)                          | CONTRACT layer (Phase 18A "approval-runtime") |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| Location                                     | `src/lib/chat/tool-approvals.ts`, `src/lib/db/approvals.ts`, `src/lib/db/tool-calls.ts` | `src/lib/approval-runtime/**`                 |
| Executes tools?                              | **Yes** — `resumeApproval` → `runtime.runTool`                                          | **No** — declaration/metadata only            |
| State sets                                   | `ToolCallStatus` + `ApprovalLifecycleState` (below)                                     | `APPROVAL_LIFECYCLE_STAGES` (11 stages)       |
| `ApprovalProposalContractSchema` lives here? | No                                                                                      | **Yes** (`contracts.ts:45`)                   |

The Phase 18A layer is provably non-executing by construction: every transition
declaration pins `advances_state:false, executes_action:false, grants_authority:false`
(`src/lib/approval-runtime/lifecycle.ts:61-63`) and `ApprovalAuthorityGuardMetadataSchema`
pins `approval_decision_supported:false, execution_supported:false, …`
(`src/lib/approval-runtime/types.ts:113-130`). The architecture doc confirms the MCP
gateway is "a new _producer_ of that" contract (`docs/security/MCP_GATEWAY_ARCHITECTURE.md:94`).

**Consequence:** FC-2 touches BOTH surfaces additively — it extends the 18A _contract_
(what the gateway emits) AND inserts a guard in the _executor_ (what runs). The
"lifecycle states" the guard must not perturb are the executor's two state sets AND the
18A stage vocabulary. FC-2 perturbs none of the three (evidence below).

---

## 1. The full enumerated lifecycle state sets (with file:line)

### 1a. Executor — tool-call execution status (`ToolCallStatus`)

`src/lib/db/tool-calls.ts:3-11`

```
PENDING | AWAITING_APPROVAL | EXECUTING | COMPLETED | DENIED | ERROR | TIMEOUT | CANCELLED
```

This is the `tool_calls.status` column (`src/lib/db/schema.ts:77`) that `resumeApproval`
reads (`getToolCall`) and writes (`updateToolCall`).

### 1b. Executor — approval-decision state machine (`ApprovalLifecycleState`)

`src/lib/db/approvals.ts:4-9`

```
pending | approved | denied | expired | cancelled
```

Persisted decision enum `ApprovalDecision` (`approvals.ts:11-17`):
`PENDING | APPROVED_ONCE | APPROVED_SESSION | DENIED | EXPIRED | CANCELLED`.
Human-input decision `ApiApprovalDecision` (`approvals.ts:66-69`):
`APPROVED_ONCE | APPROVED_SESSION | DENIED`.
Verification outcome `ApprovalVerificationStatus` (`approvals.ts:71-80`):
`granted | required | denied | expired | cancelled | replayed | invalid_token | session_not_allowed | missing`.

### 1c. Contract layer — Phase 18A stage vocabulary (`APPROVAL_LIFECYCLE_STAGES`)

`src/lib/approval-runtime/types.ts:3-15`

```
PROPOSED | REVIEW_PENDING | APPROVED | DENIED | EXPIRED | EXECUTION_PENDING |
EXECUTED | VERIFICATION_PENDING | VERIFIED | FAILED | COMPENSATION_AVAILABLE
```

Allowed-transition map: `src/lib/approval-runtime/lifecycle.ts:9-24`. Terminal stages:
`lifecycle.ts:26-30` (`DENIED, EXPIRED, VERIFIED`).

**State-set pins that FC-2 must (and does) respect:**

- `APPROVAL_LIFECYCLE_STAGES` is exact-pinned `toEqual` the 11-stage list
  (`src/lib/approval-runtime/approval-lifecycle-contract.test.ts:177-189`), plus
  `isApprovalLifecycleStage("AUTO_APPROVED") === false` (`:191`). FC-2 adds no stage ⇒ pass.
- `APPROVAL_ALLOWED_TRANSITIONS` is exact-pinned (`approval-lifecycle-contract.test.ts:194-215`),
  and illegal transitions throw (`:217-242`). FC-2 adds/alters no transition ⇒ pass.

---

## 2. `resumeApproval` — signature, decision point, flow (with file:line)

**Definition:** `src/lib/chat/tool-approvals.ts:243-369`. Confirmed sole executor / only path
to `runtime.runTool` (Phase 23 I1; `docs/PHASE23_SPEC_v1.md:208`;
`docs/security/MCP_GATEWAY_THREAT_MODEL.md:118`).

Signature (`tool-approvals.ts:243-255`):

```ts
export async function resumeApproval(input: {
  db;
  runtime: ToolRuntime;
  executionId: string;
  decision: ApiApprovalDecision;
  approvalToken?: string;
  now?: number;
  sessionTtlMs?: number;
  signal?: AbortSignal;
  recordEvent?: (event) => void;
}): Promise<ResumeApprovalResult>;
```

Flow / state transitions it drives:
| Line(s) | Action | Effect |
|---|---|---|
| `257` | `expirePendingApprovals(db, now)` | **EXISTING staleness sweep** — pending → expired by TTL |
| `259-271` | `getToolCall` → 404 if missing | — |
| `273-280` | `decideApprovalByExecution(...)` | **THE DECISION POINT** — verifies + records the human decision |
| `282-312` | `decision === "DENIED"` branch | `updateToolCall(status:"DENIED")`, persist, `tool_denied`, return |
| `314-340` | `approval.status !== "granted"` GUARD | finalize as `DENIED` (expired/denied/cancelled), `tool_denied`, return — **no execution, no new state** |
| `342-348` | `tool_approved` telemetry | only reached when granted |
| **`350-357`** | **`await input.runtime.runTool({...})`** | **THE EXECUTION (the sole runTool call)** |
| `359-368` | return `result` | terminal status from runtime |

**The human-decision point and pre-execution gate sit between `tool-approvals.ts:340` and
`:350`.** Critically, the block at `314-340` is an existing precedent: an additional check
between decision and execution that, on failure, produces a non-execution terminal outcome
(`DENIED`) **without any new state**. FC-2's re-validation has exactly this shape.

---

## 3. Decision recording, authority, and the EXISTING re-validation/staleness

**Where the decision is recorded:** the `approvals` SQLite table (`schema.ts:100-112`).
`createPendingApproval` INSERTs `state='pending'` + `token_hash` + `expires_at`
(`approvals.ts:203-226`); `decideApprovalByExecution` UPDATEs `state`/`decision`/`expires_at`
(`approvals.ts:269-321`). The tool-call status is recorded in `tool_calls` via `updateToolCall`
(`tool-approvals.ts:288-293, 316-320`). Telemetry events (`tool_denied`/`tool_approved`) are
emitted via `recordEvent` (`tool-approvals.ts:294-301, 322-329, 342-348`).

**Authority to record the decision:** possession of the one-time **approval token**, issued at
proposal time (`createPendingApproval` returns `token`; stored as `token_hash`,
`approvals.ts:209,219`) and verified at the decision point by constant-time compare
(`tokensMatch` → `timingSafeEqual`, `approvals.ts:99-104`, called at `:282`). The HTTP boundary
`POST /api/chat/approvals/[executionId]` carries exactly `{ decision ∈
{APPROVED_ONCE, APPROVED_SESSION, DENIED}, approvalToken? }`
(`app/api/chat/approvals/[executionId]/route.ts:8-11, 39-47`). This is the human-session marker
relevant to EoP-12 (`docs/security/MCP_GATEWAY_THREAT_MODEL.md:127`).

**Existing re-validation already at the decision point** (`decideApprovalByExecution`,
`approvals.ts:269-321`), in order:

1. row exists (`:280-281`)
2. **token authority** — `tokensMatch` (`:282-284`)
3. **not-expired** — `expires_at <= decidedAt` → expire + `expired` (`:285-288`)
4. state not denied/cancelled/expired (`:289-291`)
5. **replay** — already approved / consumed (`:292-294`)
6. pending-only (`:295`)
7. **session-allowed** — `APPROVED_SESSION` + `allowSession===false` → `session_not_allowed`
   (`:300-302`); `allowSession` is gated on `required_safety_tag !== "CONFIRM_ALWAYS"`
   (`tool-approvals.ts:279`).

**Mapping to the FC-2 checklist:** `not-expired` is ALREADY present (step 3 + the `:257`
sweep). The proposal's `scope_hash` is ALREADY frozen at creation (`createPendingApproval`,
`approvals.ts:217`; column `schema.ts:105`). FC-2 therefore **extends an existing
pre-execution check set** with: `scope-still-valid`, `client-still-active`,
`tool-still-allowed`, `target-still-allowed`, `hash-unchanged`. These are new read-only
validations whose failure takes the existing terminal-`DENIED` path — not new states.

---

## 4. The proposal contract — fields + extensibility finding

`ApprovalProposalContractSchema` — `src/lib/approval-runtime/contracts.ts:45-69`, a
**`z.strictObject`**. Fields (all required unless noted):

| field                            | type                 | notes                                                   |
| -------------------------------- | -------------------- | ------------------------------------------------------- |
| `contract_version`               | literal `"18A.1"`    | `APPROVAL_RUNTIME_CONTRACT_VERSION` (`contracts.ts:21`) |
| `proposal_id`                    | `proposal:…`         |                                                         |
| `approval_id`                    | `approval:…` \| null | nullable                                                |
| `proposal_kind`                  | enum                 | `tool_write,…` (`types.ts:17-23`)                       |
| `risk_class`                     | enum                 | `low/medium/high/critical`                              |
| `source_ref_hash`                | `hash:…`             |                                                         |
| `subject_ref_hash`               | `hash:…`             |                                                         |
| `dry_run_preview_ref_hash`       | `hash:…` \| null     | nullable                                                |
| `created_at_ms`                  | int ≥0               |                                                         |
| **`expires_at_ms`**              | int ≥0               | **already present** — FC-2 reuses it for `not-expired`  |
| `replay` / `redaction` / `guard` | metadata objects     | all `:false`-pinned guards                              |

**Extensibility verdict: additively extensible by DECLARED optional fields; NOT pinned closed
against them.**

- `z.strictObject` rejects only **undeclared** keys. A new field added to the schema as
  `.optional()` is accepted; the existing `proposal()` fixture (which omits it) keeps parsing
  (`approval-lifecycle-contract.test.ts:73-92`). So additive optional fields are safe.
- **No frozen test pins the proposal's key set exhaustively.** The schema symbol is referenced
  in exactly two test files (full grep): `phase-18a-closeout.test.ts` and
  `approval-lifecycle-contract.test.ts`.
  - `phase-18a-closeout.test.ts:105` only asserts `typeof …safeParse === "function"`; every
    structural assertion there is `toMatchObject` (partial; extra fields allowed); its `toEqual`
    assertions are on registry kinds / slice lists / capability lists (`:95,122,180`), never the
    contract's keys.
  - `approval-lifecycle-contract.test.ts` pins only: forbidden metadata keys are rejected
    (`:326-334`; the forbidden list is `tool_args/payload/command/…`, `contracts.ts:23-43`, and
    does **not** include FC-2's fields), guard literals are false (`:346-368`; FC-2 does not
    touch `guard`), and the 4-field validation **result** shape (`:270-276`, not the contract's
    keys).
- This is the analog the slice told me to check for (the Phase 13 registry-pin / E-008
  exhaustiveness pin). **It does not exist for this contract.**

**One design guardrail (not a blocker):** the contract's forbidden-field guard recurses
(`hasForbiddenMetadataField`, `contracts.ts:179-194`) and the closeout test scans validation
output for raw keys (`phase-18a-closeout.test.ts:27-41, 216-218`). FC-2's `scope_snapshot`
therefore MUST be metadata-only (hashes/ids), never raw scope content — consistent with the
existing redaction discipline. Easiest: carry `scope_snapshot` as a `hash:`-shaped ref
(`scope_snapshot_ref_hash`) or a strictObject of metadata-only fields.

---

## 5. The carrier — where the frozen hash/snapshot rides through the executor

The 18A contract is produced by the gateway, but `resumeApproval` re-validates against the
`approvals`/`tool_calls` rows. The hash/snapshot must be set at proposal time and re-read at the
decision point. This is additive and unpinned:

- The `approvals` row already freezes `scope_hash` at creation (`approvals.ts:217`,
  `schema.ts:105`). FC-2's `canonical_effect_hash` + `scope_snapshot_hash` ride **additive
  columns** via the codebase's established idempotent migration pattern — `hasColumn(...)` guard
  - `ALTER TABLE approvals ADD COLUMN …` (`schema.ts:616-654`; precedent: `state`/`token_hash`
    added at `:641-654`).
- **No frozen test exact-pins the `approvals` or `tool_calls` columns.** `schema.test.ts`
  exact-pins (`columnNames(...).toEqual([...])`) many tables (`long_term_memory:89`,
  `projects:113`, `project_*`, `environment_*`, `runtime_command_calls:278`, …) but a full-repo
  grep for `columnNames("approvals")` / `columnNames("tool_calls")` returns **zero** matches;
  both tables appear only in the presence check `tableNames().toEqual(expect.arrayContaining([…]))`
  (`schema.test.ts:52-87`). Adding columns to them breaks no frozen test.

---

## 6. VERDICT A — WRAPS CLEANLY (GATE-1 PASS): the 24C insertion SPEC

FC-2 is expressed as three additive moves, none adding/altering a state or transition:

**(a) Additive OPTIONAL fields on `ApprovalProposalContractSchema`** (`contracts.ts:45-69`),
declared in the strictObject so frozen consumers ignore them:

- `canonical_effect_hash: z.string().trim().regex(/^hash:[a-z0-9._:-]+$/).optional()`
- `scope_snapshot_ref_hash: z.string().trim().regex(/^hash:[a-z0-9._:-]+$/).optional()`
  (metadata-only; raw scope content forbidden — see §4 guardrail)
- `expires_at_ms` — **already exists** (`contracts.ts:65`); reuse, add nothing.

**(b) A re-validation GUARD at the existing human-decision point** in `resumeApproval`:

- **Exact insertion point:** `src/lib/chat/tool-approvals.ts:341` — i.e. AFTER the existing
  non-granted guard closes (line `340`) and BEFORE the `tool_approved` telemetry (line `342`)
  and the `runtime.runTool` call (line `350`). Placing it before `342` ensures a failed
  re-validation emits `tool_denied`, not `tool_approved`.
- **On failure** (any of not-expired / scope-still-valid / client-still-active /
  tool-still-allowed / target-still-allowed / hash-unchanged fails): mirror the existing
  non-granted block (`tool-approvals.ts:315-339`) — `updateToolCall(db, executionId,
{ status: "DENIED", error_message, completed_at: now })`, emit a `tool_denied` event with a
  new `error_class` (e.g. `"ApprovalRevalidationFailed"`), and `return` a failure
  `ResumeApprovalResult` (e.g. `httpStatus 409`/`410`) **without** calling `runTool`. Terminal
  state reused: `DENIED` (`ToolCallStatus`, `tool-calls.ts:8`). **No new state.**
- **On pass:** fall through unchanged to `342` → `350`.

**(c) Carrier columns** on `approvals` (additive, via `hasColumn` + `ALTER TABLE … ADD COLUMN`,
`schema.ts:616-654`): `canonical_effect_hash TEXT`, `scope_snapshot_hash TEXT`, set in
`createPendingApproval` (`approvals.ts:203-226`) / `ensurePendingToolApproval`
(`tool-approvals.ts:207-241`), re-read by the guard. (`scope_hash` is already carried, so
`scope-still-valid`/`hash-unchanged` can compare a freshly recomputed hash against the stored
value with minimal new columns.)

**Evidence that this needs no new state / no altered transition / no frozen test reshape:**

- Executor states (`ToolCallStatus` `tool-calls.ts:3-11`; `ApprovalLifecycleState`
  `approvals.ts:4-9`) — unchanged; the guard reuses `DENIED`/`denied`.
- 18A stage vocabulary + transitions — unchanged; their exact pins
  (`approval-lifecycle-contract.test.ts:177-215`) stay green.
- Proposal contract — additive optional fields only; no closed/exhaustiveness pin exists (§4).
- Carrier tables — additive columns only; no exact column pin exists (§5).
- Existing `resumeApproval` test call sites (`fs-write.test.ts`, `tool-approvals.test.ts`,
  `phase5-closeout-guard.test.ts`) do not set the new optional fields; gate the guard on their
  presence and those tests are unaffected.

---

## 7. Residual notes / explicit ambiguities

- **Two-surface threading is new WIRING, not a state change.** Carrying the gateway-produced
  `canonical_effect_hash` from the 18A contract into the `approvals` row at creation, then
  re-validating at `resumeApproval`, is additive plumbing for 24C to build; it does not touch
  any state or transition. Flagged so 24C scopes it, not as a GATE-1 blocker.
- **`scope_snapshot` redaction.** Must be metadata-only (§4 guardrail) or it trips the
  forbidden-field guard / closeout raw-key scan. A design constraint, not a frozen-test break.
- **No Verdict-B caveat found.** I specifically searched for an exhaustiveness/registry-pin
  test that an added field/column would break (the E-008 / Phase-13 analog): none exists for the
  proposal contract or the `approvals`/`tool_calls` carrier tables. Had one existed, this would
  be Verdict B; it does not, so this is Verdict A.
- **Scope honoured:** read-only; single agent; no subagents/fan-out; no implementation, schema,
  or test changes; this findings doc is the only artifact committed.
