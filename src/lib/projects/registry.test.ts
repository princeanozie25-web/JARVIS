import { describe, expect, it } from "vitest";
import {
  createProjectRegistrationDraft,
  projectFromRow,
  validateProjectRootKind,
  validateProjectStatus,
} from ".";

describe("project registry domain models", () => {
  it("maps registered project rows into typed derived project models", () => {
    expect(
      projectFromRow({
        id: "proj_opaque",
        slug: "jarvis",
        display_name: "JARVIS",
        root_kind: "fs",
        root_ref: "workspace-ref",
        created_at: 1_000,
        archived_at: null,
        status: "active",
      }),
    ).toEqual({
      id: "proj_opaque",
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "fs",
      rootRef: "workspace-ref",
      createdAt: 1_000,
      archivedAt: null,
      status: "active",
      indexedAt: null,
    });
  });

  it("creates opaque registration draft ids that are not derived from roots", () => {
    const draft = createProjectRegistrationDraft({
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "fs",
      rootRef: "C:/Users/princ/Documents/jarvis",
      status: "paused",
      newId: () => "fixed-id",
    });

    expect(draft.id).toBe("proj_fixed-id");
    expect(draft.id).not.toBe(draft.rootRef);
    expect(draft.status).toBe("paused");
  });

  it("validates root kinds and statuses", () => {
    expect(validateProjectRootKind("obsidian")).toBe("obsidian");
    expect(validateProjectStatus("paused")).toBe("paused");
    expect(() => validateProjectRootKind("network")).toThrow();
    expect(() => validateProjectStatus("running")).toThrow();
  });
});
