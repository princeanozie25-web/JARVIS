import { describe, expect, it } from "vitest";
import {
  createProjectRegistrationDraft,
  projectBlockerFromRow,
  projectDecisionFromRow,
  projectFromRow,
  projectIndexSnapshotFromRow,
  projectSourceFromRow,
  projectTaskFromRow,
  projectThreadFromRow,
  validateProjectBlockerStatus,
  validateProjectIndexSnapshotStatus,
  validateProjectRootKind,
  validateProjectSourceKind,
  validateProjectStatus,
  validateProjectTaskStatus,
  validateProjectThreadStatus,
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

  it("maps derived artifact rows into typed cache models", () => {
    expect(
      projectThreadFromRow({
        id: "pth_1",
        project_id: "proj_opaque",
        title: "Thread",
        status: "open",
        first_seen_at: 1_000,
        last_active_at: 1_100,
        origin_ref: "thread:source",
      }),
    ).toEqual({
      id: "pth_1",
      projectId: "proj_opaque",
      title: "Thread",
      status: "open",
      firstSeenAt: 1_000,
      lastActiveAt: 1_100,
      originRef: "thread:source",
    });
    expect(
      projectTaskFromRow({
        id: "ptask_1",
        project_id: "proj_opaque",
        thread_id: "pth_1",
        title: "Task",
        status: "extracted",
        confidence: 0.75,
        promoted: 0,
        origin_ref: "thread:source",
        created_at: 1_000,
        updated_at: 1_100,
      }),
    ).toEqual({
      id: "ptask_1",
      projectId: "proj_opaque",
      threadId: "pth_1",
      title: "Task",
      status: "extracted",
      confidence: 0.75,
      promoted: false,
      originRef: "thread:source",
      createdAt: 1_000,
      updatedAt: 1_100,
    });
    expect(
      projectBlockerFromRow({
        id: "pblk_1",
        project_id: "proj_opaque",
        task_id: null,
        description: "Blocker",
        status: "open",
        origin_ref: "thread:source",
      }),
    ).toEqual({
      id: "pblk_1",
      projectId: "proj_opaque",
      taskId: null,
      description: "Blocker",
      status: "open",
      originRef: "thread:source",
    });
    expect(
      projectDecisionFromRow({
        id: "pdec_1",
        project_id: "proj_opaque",
        summary: "Decision",
        decided_at: null,
        origin_ref: "thread:source",
      }),
    ).toEqual({
      id: "pdec_1",
      projectId: "proj_opaque",
      summary: "Decision",
      decidedAt: null,
      originRef: "thread:source",
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
    expect(validateProjectThreadStatus("stale")).toBe("stale");
    expect(validateProjectTaskStatus("blocked")).toBe("blocked");
    expect(validateProjectBlockerStatus("cleared")).toBe("cleared");
    expect(() => validateProjectRootKind("network")).toThrow();
    expect(() => validateProjectStatus("running")).toThrow();
    expect(() => validateProjectSourceKind("network_url")).toThrow();
    expect(() => validateProjectIndexSnapshotStatus("queued")).toThrow();
    expect(() => validateProjectThreadStatus("active")).toThrow();
    expect(() => validateProjectTaskStatus("queued")).toThrow();
    expect(() => validateProjectBlockerStatus("blocked")).toThrow();
  });
});
