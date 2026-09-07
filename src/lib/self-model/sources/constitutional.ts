// Self Model (E-050) — the CONSTITUTIONAL self.
//
// What JARVIS is, whom it serves, and what it may never do — composed from
// the governed sources that already say so: the system prompt (identity),
// canonical-policy (approval tiers), the Phase 20 authority-surface
// inventory and disabled-feature matrix, and the Phase 14 voice governance
// invariants. Nothing in this file invents a principle.
import { approvalTierOf } from "../../canonical-policy";
import {
  getAuthoritySurfacesRequiringApproval,
  getFinalAuthoritySurfaceInventory,
} from "../../final-system-status/authority-surface-inventory";
import { getFinalDisabledFeatureMatrix } from "../../final-system-status/disabled-feature-matrix";
import { VOICE_RUNTIME_GOVERNANCE_INVARIANTS } from "../../voice-runtime/governance";
import { claim, evidence, type SelfClaim } from "../contracts";
import { scrubText } from "../redaction";

export interface ConstitutionalSourceInput {
  now: string;
  // The loaded system prompt text (prompts/jarvis_system.md) or null when
  // the file is unavailable. Only its identity line is read.
  systemPromptText: string | null;
  systemPromptRef?: string;
}

export interface ParsedIdentity {
  name: string;
  role: string;
  owner: string;
}

export function parseIdentityLine(text: string): ParsedIdentity | null {
  const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const m = /^You are ([A-Za-z0-9_-]+),\s*(.+?)\s+for\s+(.+?)\.?\s*$/.exec(
    first.trim(),
  );
  if (!m) return null;
  return { name: m[1]!, role: m[2]!, owner: m[3]! };
}

// The Self Model's own standing limits. These are not aspirations: each one
// is enforced by code this slice ships (writers.ts, tools.ts) or by the
// frozen executor path (ToolRuntime.runTool + Human Gate).
export const SELF_MODEL_STANDING_LIMITS = [
  {
    id: "self-modification",
    statement:
      "I cannot modify my own code, configuration, policies, prompts or authority. The Self Model is read-only; there is no self.modify tool and no writer that changes behaviour.",
    ref: "src/lib/self-model/writers.ts",
  },
  {
    id: "authority-escalation",
    statement:
      "I cannot grant myself authority. Approval tiers come from canonical-policy and the Human Gate; introspection never changes a tier, a grant or an approval.",
    ref: "src/lib/canonical-policy/index.ts",
  },
  {
    id: "secrets",
    statement:
      "I can report that a credential is configured; I never expose its value. Self-model payloads are refused if they carry secret-shaped values or credential keys.",
    ref: "src/lib/self-model/redaction.ts",
  },
  {
    id: "execution-path",
    statement:
      "Every tool I run passes through the single tool-runtime entry point: validation, approval check, audit row, telemetry, timeout. I have no side channel to execute anything.",
    ref: "src/lib/tools/types.ts",
  },
  {
    id: "database-writes",
    statement:
      "Introspection has no general database write access. Its only writes are typed self-snapshot / self-observation events through the existing event store.",
    ref: "src/lib/self-model/writers.ts",
  },
] as const;

export function buildConstitutionalClaims(
  input: ConstitutionalSourceInput,
): SelfClaim[] {
  const now = input.now;
  const promptRef = input.systemPromptRef ?? "prompts/jarvis_system.md";
  const claims: SelfClaim[] = [];

  const identity = input.systemPromptText
    ? parseIdentityLine(scrubText(input.systemPromptText))
    : null;
  claims.push(
    identity
      ? claim({
          claim_id: "self:identity",
          category: "identity",
          subject: "identity",
          statement: `I am ${identity.name}, ${identity.role} for ${identity.owner}.`,
          status: "operational",
          trust_class: "config_registry",
          observed_at: now,
          ttl_ms: null,
          evidence: [
            evidence(
              "config",
              promptRef,
              now,
              "identity line of the system prompt",
            ),
          ],
        })
      : claim({
          claim_id: "self:identity",
          category: "identity",
          subject: "identity",
          statement:
            "My identity line could not be read from the system prompt; I do not assert a name or owner without it.",
          status: "unknown",
          trust_class: "config_registry",
          observed_at: now,
          ttl_ms: null,
          evidence: [
            evidence(
              "unavailable",
              promptRef,
              now,
              "prompt file unreadable or unparseable",
            ),
          ],
        }),
  );

  claims.push(
    claim({
      claim_id: "self:identity.role",
      category: "identity",
      subject: "identity.role",
      statement:
        "I am an operator, not a chatbot: a governed personal AI operating environment. I propose; execution is gated.",
      status: "operational",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [evidence("config", promptRef, now)],
    }),
  );

  // Approval tiers, computed from the live policy leaf (not restated).
  const tRead = approvalTierOf("PURE_READ", "ALLOW");
  const tRev = approvalTierOf("REVERSIBLE_WRITE", "ALLOW");
  const tIrr = approvalTierOf("IRREVERSIBLE", "ALLOW");
  const tBlock = approvalTierOf("IRREVERSIBLE", "BLOCK");
  claims.push(
    claim({
      claim_id: "self:constitution.approval-tiers",
      category: "constitution",
      subject: "constitution.approval-tiers",
      statement: `Execution authority is tiered by reversibility × safety tag: pure reads → ${tRead}; reversible writes → ${tRev}; irreversible actions → ${tIrr}; blocked actions → ${tBlock}. Nothing above '${tRead}' proceeds without the Human Gate.`,
      status: "operational",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence(
          "policy",
          "src/lib/canonical-policy/index.ts#approvalTierOf",
          now,
        ),
      ],
    }),
  );

  const surfaces = getFinalAuthoritySurfaceInventory();
  const requiring = getAuthoritySurfacesRequiringApproval();
  claims.push(
    claim({
      claim_id: "self:constitution.authority-surfaces",
      category: "constitution",
      subject: "constitution.authority-surfaces",
      statement: `I have ${surfaces.length} inventoried authority surfaces; ${requiring.length} require approval to act and none allows auto-approval.`,
      status: "operational",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence(
          "policy",
          "src/lib/final-system-status/authority-surface-inventory.ts",
          now,
        ),
      ],
    }),
  );
  for (const s of surfaces) {
    claims.push(
      claim({
        claim_id: `self:${s.surface_id.replace(/:/g, ".")}`,
        category: "constitution",
        subject: s.surface_id,
        statement: `${s.label}: read ${s.read_authority}, write ${s.write_authority}, execute ${s.execute_authority}; approval ${s.approval_requirement}; network ${s.network_posture}.`,
        status: "operational",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [evidence("policy", s.surface_id, now, s.governance_notes)],
      }),
    );
  }

  const disabled = getFinalDisabledFeatureMatrix();
  claims.push(
    claim({
      claim_id: "self:constitution.disabled-features",
      category: "limit",
      subject: "constitution.disabled-features",
      statement: `${disabled.length} features are deliberately disabled by the Phase 20 matrix (${disabled.filter((d) => d.critical).length} critical). They stay disabled until a registry entry re-opens them.`,
      status: "operational",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence(
          "policy",
          "src/lib/final-system-status/disabled-feature-matrix.ts",
          now,
        ),
      ],
    }),
  );
  for (const d of disabled) {
    claims.push(
      claim({
        claim_id: `self:${d.feature_id.replace(/:/g, ".")}`,
        category: "limit",
        subject: d.feature_id,
        statement: `${d.label} — disabled: ${d.disabled_reason}`,
        status: "unsupported",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence(
            "policy",
            d.feature_id,
            now,
            `enforcement ${d.enforcement_posture}`,
          ),
        ],
      }),
    );
  }

  const inv = VOICE_RUNTIME_GOVERNANCE_INVARIANTS;
  const held = Object.entries(inv)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  claims.push(
    claim({
      claim_id: "self:constitution.voice-governance",
      category: "constitution",
      subject: "constitution.voice-governance",
      statement: `Voice is transport, not authority (Phase 14 invariants: ${held}). A spoken request still goes through the router, the safety layers and the Human Gate.`,
      status: "operational",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence("policy", "src/lib/voice-runtime/governance.ts", now),
      ],
    }),
  );

  for (const l of SELF_MODEL_STANDING_LIMITS) {
    claims.push(
      claim({
        claim_id: `self:limit.${l.id}`,
        category: "limit",
        subject: `limit.${l.id}`,
        statement: l.statement,
        status: "operational",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [evidence("policy", l.ref, now)],
      }),
    );
  }

  return claims;
}
