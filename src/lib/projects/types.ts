import { z } from "zod";

export const PROJECT_ROOT_KINDS = [
  "fs",
  "memory",
  "obsidian",
  "virtual",
] as const;

export const PROJECT_STATUSES = ["active", "paused", "archived"] as const;

export type ProjectRootKind = (typeof PROJECT_ROOT_KINDS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ProjectRootKindSchema = z.enum(PROJECT_ROOT_KINDS);
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);

export const ProjectSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RegisteredProjectSchema = z.object({
  id: z.string().trim().min(1).max(200),
  slug: ProjectSlugSchema,
  displayName: z.string().trim().min(1).max(200),
  rootKind: ProjectRootKindSchema,
  rootRef: z.string().trim().min(1).max(500),
  createdAt: z.number().int().nonnegative(),
  archivedAt: z.number().int().nonnegative().nullable(),
  status: ProjectStatusSchema,
  indexedAt: z.null(),
});

export type RegisteredProject = z.infer<typeof RegisteredProjectSchema>;

export interface ProjectRegistrationDraft {
  id: string;
  slug: string;
  displayName: string;
  rootKind: ProjectRootKind;
  rootRef: string;
  status: ProjectStatus;
}

export const PROJECT_STATE_AUTHORITY_NOTE =
  "Phase 5 project state is a read-mostly derived cache over canonical sources, not a source of truth.";
