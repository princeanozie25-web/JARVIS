import { z } from "zod";
import { ApprovalIdSchema } from "../approval-runtime/types";
import {
  VAULT_APPROVAL_STATUSES,
  VAULT_DOMAINS,
  VAULT_GITNEXUS_NOTE_TYPES,
  VAULT_NOTE_STATUSES,
  VAULT_NOTE_TYPES,
  VAULT_PROMOTION_STATUSES,
  VAULT_PROVENANCE_SOURCE_TYPES,
  VAULT_SENSITIVITY_LEVELS,
} from "./taxonomy";

export const VAULT_FRONTMATTER_SCHEMA_VERSION = 1 as const;

const VaultIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const VaultSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

const VaultIsoTimestampSchema = z.string().trim().datetime({ offset: true });

const VaultContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VaultNoteTypeSchema = z.enum(VAULT_NOTE_TYPES);
export const VaultDomainSchema = z.enum(VAULT_DOMAINS);
export const VaultNoteStatusSchema = z.enum(VAULT_NOTE_STATUSES);
export const VaultSensitivitySchema = z.enum(VAULT_SENSITIVITY_LEVELS);
export const VaultPromotionStatusSchema = z.enum(VAULT_PROMOTION_STATUSES);
export const VaultApprovalStatusSchema = z.enum(VAULT_APPROVAL_STATUSES);
export const VaultProvenanceSourceTypeSchema = z.enum(
  VAULT_PROVENANCE_SOURCE_TYPES,
);

export const VaultProvenanceSchema = z.strictObject({
  source_type: VaultProvenanceSourceTypeSchema,
  source_id: z.string().trim().min(1).nullable(),
  source_url: z.string().trim().min(1).nullable(),
  content_hash: VaultContentHashSchema.nullable(),
});

export const VaultAgentAttributionSchema = z.strictObject({
  created_by: z.string().trim().min(1).nullable(),
  run_id: z.string().trim().min(1).nullable(),
  model_id: z.string().trim().min(1).nullable(),
  promotion_status: VaultPromotionStatusSchema,
});

export const VaultLinksSchema = z.strictObject({
  related: z.array(z.string().trim().min(1)).default([]),
  sources: z.array(z.string().trim().min(1)).default([]),
  decisions: z.array(z.string().trim().min(1)).default([]),
});

export const VaultLifecycleSchema = z.strictObject({
  durable: z.boolean(),
  canonical: z.boolean(),
  approval_status: VaultApprovalStatusSchema,
  approval_id: ApprovalIdSchema.nullable().default(null),
  review_after: VaultIsoTimestampSchema.nullable(),
  supersedes: z.array(z.string().trim().min(1)).default([]),
  superseded_by: z.array(z.string().trim().min(1)).default([]),
});

export const VaultFrontmatterSchema = z
  .strictObject({
    schema_version: z.literal(VAULT_FRONTMATTER_SCHEMA_VERSION),
    id: VaultIdSchema,
    title: z.string().trim().min(1).max(200),
    note_type: VaultNoteTypeSchema,
    domain: VaultDomainSchema,
    status: VaultNoteStatusSchema,
    created_at: VaultIsoTimestampSchema,
    updated_at: VaultIsoTimestampSchema,
    tags: z.array(z.string().trim().min(1).max(64)).max(30).default([]),
    sensitivity: VaultSensitivitySchema,
    project: VaultSlugSchema.nullable().default(null),
    provenance: VaultProvenanceSchema,
    agent: VaultAgentAttributionSchema,
    links: VaultLinksSchema.default({
      related: [],
      sources: [],
      decisions: [],
    }),
    lifecycle: VaultLifecycleSchema,
  })
  .superRefine((note, ctx) => {
    if (note.lifecycle.durable || note.lifecycle.canonical) {
      if (note.lifecycle.approval_status !== "approved") {
        ctx.addIssue({
          code: "custom",
          path: ["lifecycle", "approval_status"],
          message: "Durable or canonical vault notes require approval.",
        });
      }
      if (!note.lifecycle.approval_id) {
        ctx.addIssue({
          code: "custom",
          path: ["lifecycle", "approval_id"],
          message: "Durable or canonical vault notes require an approval id.",
        });
      }
    }

    if (
      note.agent.created_by &&
      (note.lifecycle.durable || note.lifecycle.canonical) &&
      note.agent.promotion_status !== "human_approved"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["agent", "promotion_status"],
        message:
          "Agent outputs cannot directly become durable notes without human approval.",
      });
    }

    if (isGitNexusNoteType(note.note_type) && !note.project) {
      ctx.addIssue({
        code: "custom",
        path: ["project"],
        message: "GitNexus notes require a project for project routing.",
      });
    }
  });

export type VaultFrontmatter = z.infer<typeof VaultFrontmatterSchema>;

function isGitNexusNoteType(noteType: string): boolean {
  return (VAULT_GITNEXUS_NOTE_TYPES as readonly string[]).includes(noteType);
}

export function parseVaultFrontmatter(input: unknown): VaultFrontmatter {
  return VaultFrontmatterSchema.parse(input);
}

export function validateVaultFrontmatter(input: unknown) {
  return VaultFrontmatterSchema.safeParse(input);
}
