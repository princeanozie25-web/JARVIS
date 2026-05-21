import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { insertRegisteredProject } from "../db/projects";
import type { RouterDecision } from "../router";
import { InProcessToolRuntime, tools } from ".";

const allowDecision: RouterDecision = {
  intent: { intent: "CONVERSATIONAL", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let runtime: InProcessToolRuntime;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  runtime = new InProcessToolRuntime(tools, {
    db,
    toolsEnabled: true,
    bindHost: "127.0.0.1",
  });
});

afterEach(() => {
  db.close();
});

describe("Phase 5 project tools", () => {
  it("project.list returns registered rows", async () => {
    insertRegisteredProject(db, {
      id: "proj_jarvis",
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "fs",
      rootRef: "workspace-ref",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.list",
      input: { maxResults: 10 },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        count: 1,
        derivedState: true,
        projects: [
          expect.objectContaining({
            id: "proj_jarvis",
            slug: "jarvis",
            displayName: "JARVIS",
            rootKind: "fs",
            rootRef: "workspace-ref",
            status: "active",
            indexedAt: null,
          }),
        ],
      },
    });
  });

  it("project.get returns one registered row", async () => {
    insertRegisteredProject(db, {
      id: "proj_lookup",
      slug: "lookup",
      displayName: "Lookup",
      rootKind: "virtual",
      rootRef: "virtual:lookup",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { slug: "lookup" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        project: expect.objectContaining({
          id: "proj_lookup",
          slug: "lookup",
          indexedAt: null,
        }),
        derivedState: true,
      },
    });
  });

  it("handles registered-but-unindexed projects cleanly", async () => {
    insertRegisteredProject(db, {
      id: "proj_unindexed",
      slug: "unindexed",
      displayName: "Unindexed",
      rootKind: "memory",
      rootRef: "memory:unindexed",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_unindexed" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result.data).toMatchObject({
      project: expect.objectContaining({
        id: "proj_unindexed",
        indexedAt: null,
      }),
    });
  });

  it("does not register disabled Phase 5 tools or mutation surfaces", () => {
    const registeredToolIds = tools.list().map((tool) => tool.id);

    expect(registeredToolIds).toContain("project.list");
    expect(registeredToolIds).toContain("project.get");
    expect(registeredToolIds).not.toContain("project.register");
    expect(registeredToolIds).not.toContain("project.index");
    expect(registeredToolIds).not.toContain("project.write_memory");
    expect(registeredToolIds).not.toContain("background.indexing");
    expect(registeredToolIds).not.toContain("task.auto_promote");
    expect(registeredToolIds).not.toContain("voice.project_mutation");
  });
});
