import { randomUUID } from "node:crypto";
import type { ProjectRow } from "../db/projects";
import {
  PROJECT_STATE_AUTHORITY_NOTE,
  ProjectRootKindSchema,
  ProjectSlugSchema,
  ProjectStatusSchema,
  RegisteredProjectSchema,
  type ProjectRegistrationDraft,
  type ProjectRootKind,
  type ProjectStatus,
  type RegisteredProject,
} from "./types";

export function createOpaqueProjectId(
  newId: () => string = randomUUID,
): string {
  return `proj_${newId()}`;
}

export function projectFromRow(row: ProjectRow): RegisteredProject {
  return RegisteredProjectSchema.parse({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    rootKind: row.root_kind,
    rootRef: row.root_ref,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    status: row.status,
    indexedAt: null,
  });
}

export function validateProjectRootKind(value: string): ProjectRootKind {
  return ProjectRootKindSchema.parse(value);
}

export function validateProjectStatus(value: string): ProjectStatus {
  return ProjectStatusSchema.parse(value);
}

export function createProjectRegistrationDraft(input: {
  slug: string;
  displayName: string;
  rootKind: ProjectRootKind;
  rootRef: string;
  newId?: () => string;
}): ProjectRegistrationDraft {
  const displayName = input.displayName.trim();
  const rootRef = input.rootRef.trim();
  if (!displayName) throw new Error("displayName is required");
  if (!rootRef) throw new Error("rootRef is required");

  return {
    id: createOpaqueProjectId(input.newId),
    slug: ProjectSlugSchema.parse(input.slug),
    displayName,
    rootKind: validateProjectRootKind(input.rootKind),
    rootRef,
    status: "active",
  };
}

export function projectRegistryAuthorityNote(): string {
  return PROJECT_STATE_AUTHORITY_NOTE;
}
