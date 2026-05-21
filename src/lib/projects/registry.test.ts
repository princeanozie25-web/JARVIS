import { describe, expect, it } from "vitest";
import {
  createProjectRegistrationDraft,
  projectFromRow,
  projectIndexSnapshotFromRow,
  projectSourceFromRow,
  validateProjectIndexSnapshotStatus,
  validateProjectRootKind,
  validateProjectSourceKind,
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
        source_count: 2,
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
      sourceCount: 2,
    });
  });

  it("maps source ledger rows into typed pointer models", () => {
    expect(
      projectSourceFromRow({
        id: "psrc_1",
        project_id: "proj_opaque",
        kind: "file",
        ref: "README.md",
        last_indexed_at: null,
        source_hash: null,
      }),
    ).toEqual({
      id: "psrc_1",
      projectId: "proj_opaque",
      kind: "file",
      ref: "README.md",
      lastIndexedAt: null,
      sourceHash: null,
    });
  });

  it("maps index snapshot rows into typed metadata-only models", () => {
    expect(
      projectIndexSnapshotFromRow({
        id: "pidx_1",
        project_id: "proj_opaque",
        started_at: 2_000,
        finished_at: 2_100,
        sources_seen: 3,
        artifacts_extracted: 0,
        triggered_by: "manual",
        status: "completed",
      }),
    ).toEqual({
      id: "pidx_1",
      projectId: "proj_opaque",
      startedAt: 2_000,
      finishedAt: 2_100,
      sourcesSeen: 3,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "completed",
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
    expect(validateProjectSourceKind("thread")).toBe("thread");
    expect(validateProjectIndexSnapshotStatus("rejected")).toBe("rejected");
    expect(() => validateProjectRootKind("network")).toThrow();
    expect(() => validateProjectStatus("running")).toThrow();
    expect(() => validateProjectSourceKind("network_url")).toThrow();
    expect(() => validateProjectIndexSnapshotStatus("queued")).toThrow();
  });
});
