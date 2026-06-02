import { z } from "zod";
import {
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VaultFrontmatterSchema,
  type VaultFrontmatter,
} from "./frontmatter";
import { routeVaultNote, type VaultRouteDecision } from "./routing";
import {
  VAULT_NOTE_TYPES,
  VAULT_PROVENANCE_SOURCE_TYPES,
  type VaultApprovalStatus,
} from "./taxonomy";

export const LIBRARIAN_CONTRACT_VERSION =
  "phase21.librarian-contract.v1" as const;

export const LIBRARIAN_SOURCE_TYPES = [
  "user_note",
  "agent_output",
  "gitnexus",
  "llm_wiki",
  "knowledge_compounding",
  "imported_document",
  "external_research",
] as const;

export const LIBRARIAN_CLASSIFICATIONS = [
  "transient",
  "candidate",
  "durable",
  "canonical",
] as const;

export const LIBRARIAN_ROUTE_TARGETS = [
  "inbox",
  "wiki",
  "project",
  "research",
  "learning",
  "career",
  "agent",
  "reference",
  "review",
  "archive",
  "meta",
] as const;

export const LIBRARIAN_DECISION_REASONS = [
  "accepted",
  "envelope_invalid",
  "frontmatter_invalid",
  "content_hash_mismatch",
  "provenance_missing",
  "routing_bypass_rejected",
  "durable_promotion_requires_approval",
  "durable_agent_promotion_requires_human_approval",
  "canonical_promotion_requires_durable_trace",
] as const;

export const LIBRARIAN_CLASSIFICATION_TRANSITIONS = [
  {
    from: "transient",
    to: "candidate",
    requires_approval: false,
    requires_provenance: true,
    requires_content_hash: true,
  },
  {
    from: "candidate",
    to: "durable",
    requires_approval: true,
    requires_provenance: true,
    requires_content_hash: true,
  },
  {
    from: "durable",
    to: "canonical",
    requires_approval: true,
    requires_provenance: true,
    requires_content_hash: true,
  },
] as const;

export const LIBRARIAN_DEDUPLICATION_CONTRACT = {
  content_hash_algorithm: "sha256",
  content_hash_format: "sha256:<64 lowercase hex chars>",
  exact_duplicate_keys: [
    "content_hash",
    "source.source_type",
    "source.source_id",
    "proposed_frontmatter.id",
  ],
  near_duplicate_strategy: "metadata_similarity_contract_only",
  near_duplicate_inputs: [
    "title",
    "source.source_id",
    "proposed_frontmatter.links.sources",
    "proposed_frontmatter.tags",
  ],
  embedding_execution_supported: false,
  vector_lookup_supported: false,
} as const;

const LibrarianContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const LibrarianIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

export const LibrarianSourceTypeSchema = z.enum(LIBRARIAN_SOURCE_TYPES);
export const LibrarianClassificationSchema = z.enum(
  LIBRARIAN_CLASSIFICATIONS,
);
export const LibrarianRouteTargetSchema = z.enum(LIBRARIAN_ROUTE_TARGETS);
export const LibrarianDecisionReasonSchema = z.enum(
  LIBRARIAN_DECISION_REASONS,
);

export const LibrarianSourceIdentifierSchema = z.strictObject({
  source_type: LibrarianSourceTypeSchema,
  source_id: z.string().trim().min(1),
  source_ref: z.string().trim().min(1).nullable().default(null),
  captured_at: z.string().trim().datetime({ offset: true }),
  provenance_source_type: z.enum(VAULT_PROVENANCE_SOURCE_TYPES),
  content_hash: LibrarianContentHashSchema,
});

export const LibrarianIngestionEnvelopeSchema = z.strictObject({
  contract_version: z.literal(LIBRARIAN_CONTRACT_VERSION),
  envelope_id: LibrarianIdSchema,
  source: LibrarianSourceIdentifierSchema,
  proposed_frontmatter: VaultFrontmatterSchema,
  declared_classification: LibrarianClassificationSchema.default("candidate"),
  requested_route_target: LibrarianRouteTargetSchema.nullable().default(null),
  requested_target_folder: z.string().trim().min(1).nullable().default(null),
  content_hash: LibrarianContentHashSchema,
  body_ref: z.string().trim().min(1).nullable().default(null),
  raw_body_included: z.literal(false),
  received_at: z.string().trim().datetime({ offset: true }),
});

export const LibrarianGovernanceSummarySchema = z.strictObject({
  write_authority: z.literal(false),
  execution_authority: z.literal(false),
  scheduler_authority: z.literal(false),
  vault_mutated: z.literal(false),
  routing_bypass_allowed: z.literal(false),
  calls_write_gateway: z.literal(false),
  calls_write_execution: z.literal(false),
  markdown_canonical: z.literal(true),
  derived_indexes_only: z.literal(true),
});

export const LibrarianDeduplicationPlanSchema = z.strictObject({
  content_hash: LibrarianContentHashSchema.nullable(),
  exact_duplicate_keys: z.array(z.string()),
  near_duplicate_strategy: z.literal("metadata_similarity_contract_only"),
  embedding_execution_supported: z.literal(false),
  vector_lookup_supported: z.literal(false),
});

export const LibrarianPromotionDecisionSchema = z.strictObject({
  classification: LibrarianClassificationSchema,
  may_become_durable: z.boolean(),
  may_become_canonical: z.boolean(),
  approval_required: z.boolean(),
  approval_status: z.enum([
    "not_required",
    "pending",
    "approved",
    "denied",
    "expired",
  ]),
  human_approval_required: z.boolean(),
  promotion_allowed: z.boolean(),
});

export const LibrarianIngestionDecisionSchema = z.strictObject({
  contract_version: z.literal(LIBRARIAN_CONTRACT_VERSION),
  accepted: z.boolean(),
  envelope_id: LibrarianIdSchema.nullable(),
  source_type: LibrarianSourceTypeSchema.nullable(),
  classification: LibrarianClassificationSchema.nullable(),
  route_target: LibrarianRouteTargetSchema.nullable(),
  target_folder: z.string().trim().min(1).nullable(),
  reasons: z.array(LibrarianDecisionReasonSchema),
  promotion: LibrarianPromotionDecisionSchema,
  deduplication: LibrarianDeduplicationPlanSchema,
  governance: LibrarianGovernanceSummarySchema,
});

export type LibrarianSourceType = z.infer<typeof LibrarianSourceTypeSchema>;
export type LibrarianClassification = z.infer<
  typeof LibrarianClassificationSchema
>;
export type LibrarianRouteTarget = z.infer<typeof LibrarianRouteTargetSchema>;
export type LibrarianDecisionReason = z.infer<
  typeof LibrarianDecisionReasonSchema
>;
export type LibrarianSourceIdentifier = z.infer<
  typeof LibrarianSourceIdentifierSchema
>;
export type LibrarianIngestionEnvelope = z.infer<
  typeof LibrarianIngestionEnvelopeSchema
>;
export type LibrarianIngestionDecision = z.infer<
  typeof LibrarianIngestionDecisionSchema
>;

export function planLibrarianIngestion(
  input: unknown,
): LibrarianIngestionDecision {
  const parsed = LibrarianIngestionEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedDecision("envelope_invalid");
  }

  const envelope = parsed.data;
  const frontmatter = envelope.proposed_frontmatter;
  const route = routeVaultNote(frontmatter);
  const classification = classifyEnvelope(envelope, frontmatter, route);
  const reasons: LibrarianDecisionReason[] = [];

  if (!hasTraceableProvenance(envelope, frontmatter)) {
    reasons.push("provenance_missing");
  }
  if (envelope.content_hash !== frontmatter.provenance.content_hash) {
    reasons.push("content_hash_mismatch");
  }
  if (
    envelope.requested_target_folder !== null &&
    envelope.requested_target_folder !== route.folder
  ) {
    reasons.push("routing_bypass_rejected");
  }

  const promotion = promotionDecision(classification, frontmatter, route);
  if (promotion.human_approval_required && !promotion.promotion_allowed) {
    if (frontmatter.agent.created_by) {
      reasons.push("durable_agent_promotion_requires_human_approval");
    } else {
      reasons.push("durable_promotion_requires_approval");
    }
  }
  if (
    classification === "canonical" &&
    !frontmatter.lifecycle.durable &&
    !frontmatter.lifecycle.canonical
  ) {
    reasons.push("canonical_promotion_requires_durable_trace");
  }
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  return LibrarianIngestionDecisionSchema.parse({
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    accepted: reasons.length === 1 && reasons[0] === "accepted",
    envelope_id: envelope.envelope_id,
    source_type: envelope.source.source_type,
    classification,
    route_target: routeTargetFromFolder(route.folder),
    target_folder: route.folder,
    reasons: unique(reasons),
    promotion,
    deduplication: deduplicationPlan(envelope.content_hash),
    governance: governanceSummary(),
  });
}

function classifyEnvelope(
  envelope: LibrarianIngestionEnvelope,
  frontmatter: VaultFrontmatter,
  route: VaultRouteDecision,
): LibrarianClassification {
  if (
    frontmatter.note_type === "agent_run" ||
    frontmatter.agent.promotion_status === "transient" ||
    route.route_kind === "agent_run"
  ) {
    return "transient";
  }
  if (frontmatter.lifecycle.canonical) {
    return "canonical";
  }
  if (
    frontmatter.lifecycle.durable ||
    ["active", "superseded", "archived"].includes(frontmatter.status)
  ) {
    return "durable";
  }
  return envelope.declared_classification;
}

function promotionDecision(
  classification: LibrarianClassification,
  frontmatter: VaultFrontmatter,
  route: VaultRouteDecision,
): z.infer<typeof LibrarianPromotionDecisionSchema> {
  const durableRequested =
    classification === "durable" ||
    classification === "canonical" ||
    route.durable;
  const canonicalRequested = classification === "canonical";
  const lifecycleApproved =
    frontmatter.lifecycle.approval_status === "approved" &&
    frontmatter.lifecycle.approval_id !== null;
  const agentApproved =
    frontmatter.agent.created_by === null ||
    frontmatter.agent.promotion_status === "human_approved";
  const approvalRequired = durableRequested || canonicalRequested;
  const promotionAllowed =
    !approvalRequired || (lifecycleApproved && agentApproved);

  return {
    classification,
    may_become_durable:
      (classification === "candidate" || durableRequested) && promotionAllowed,
    may_become_canonical: canonicalRequested && promotionAllowed,
    approval_required: approvalRequired,
    approval_status: frontmatter.lifecycle.approval_status,
    human_approval_required:
      approvalRequired && (!lifecycleApproved || !agentApproved),
    promotion_allowed: promotionAllowed,
  };
}

function hasTraceableProvenance(
  envelope: LibrarianIngestionEnvelope,
  frontmatter: VaultFrontmatter,
): boolean {
  return (
    envelope.source.source_id.length > 0 &&
    envelope.source.content_hash === frontmatter.provenance.content_hash &&
    frontmatter.provenance.source_id !== null &&
    frontmatter.provenance.content_hash !== null
  );
}

function routeTargetFromFolder(folder: string): LibrarianRouteTarget {
  if (folder.startsWith("01-inbox")) return "inbox";
  if (folder.startsWith("10-wiki")) return "wiki";
  if (folder.startsWith("20-projects")) return "project";
  if (folder.startsWith("30-research")) return "research";
  if (folder.startsWith("40-learning")) return "learning";
  if (folder.startsWith("50-career")) return "career";
  if (folder.startsWith("60-agents")) return "agent";
  if (folder.startsWith("70-references")) return "reference";
  if (folder.startsWith("80-reviews")) return "review";
  if (folder.startsWith("90-archive")) return "archive";
  return "meta";
}

function deduplicationPlan(
  contentHash: string | null,
): z.infer<typeof LibrarianDeduplicationPlanSchema> {
  return {
    content_hash: contentHash,
    exact_duplicate_keys: [...LIBRARIAN_DEDUPLICATION_CONTRACT.exact_duplicate_keys],
    near_duplicate_strategy:
      LIBRARIAN_DEDUPLICATION_CONTRACT.near_duplicate_strategy,
    embedding_execution_supported: false,
    vector_lookup_supported: false,
  };
}

function rejectedDecision(
  reason: LibrarianDecisionReason,
): LibrarianIngestionDecision {
  return LibrarianIngestionDecisionSchema.parse({
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    accepted: false,
    envelope_id: null,
    source_type: null,
    classification: null,
    route_target: null,
    target_folder: null,
    reasons: [reason],
    promotion: {
      classification: "transient",
      may_become_durable: false,
      may_become_canonical: false,
      approval_required: true,
      approval_status: "pending" satisfies VaultApprovalStatus,
      human_approval_required: true,
      promotion_allowed: false,
    },
    deduplication: deduplicationPlan(null),
    governance: governanceSummary(),
  });
}

function governanceSummary(): z.infer<typeof LibrarianGovernanceSummarySchema> {
  return {
    write_authority: false,
    execution_authority: false,
    scheduler_authority: false,
    vault_mutated: false,
    routing_bypass_allowed: false,
    calls_write_gateway: false,
    calls_write_execution: false,
    markdown_canonical: true,
    derived_indexes_only: true,
  };
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}

export const LIBRARIAN_FRONTMATTER_SCHEMA_VERSION =
  VAULT_FRONTMATTER_SCHEMA_VERSION;
export const LIBRARIAN_SUPPORTED_NOTE_TYPES = VAULT_NOTE_TYPES;
