import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_FOLDERS,
  VAULT_CANONICAL_SOURCE_POLICY,
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VAULT_NOTE_TYPES,
  VAULT_ROOT_FOLDERS,
  VaultFrontmatterSchema,
  routeVaultNote,
  slugPathSegment,
} from "./index";
import type { VaultFrontmatter } from "./frontmatter";

const APPROVED_AT = "2026-06-01T12:00:00.000Z";
const HASH = `sha256:${"a".repeat(64)}`;

function note(
  overrides: Partial<VaultFrontmatter> = {},
): VaultFrontmatter {
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: "note:phase21.example",
    title: "Phase 21 Example",
    note_type: "concept",
    domain: "wiki",
    status: "active",
    created_at: APPROVED_AT,
    updated_at: APPROVED_AT,
    tags: ["phase21"],
    sensitivity: "private",
    project: null,
    provenance: {
      source_type: "human",
      source_id: "source:phase21",
      source_url: null,
      content_hash: HASH,
    },
    agent: {
      created_by: null,
      run_id: null,
      model_id: null,
      promotion_status: "human_approved",
    },
    links: {
      related: [],
      sources: [],
      decisions: [],
    },
    lifecycle: {
      durable: true,
      canonical: true,
      approval_status: "approved",
      approval_id: "approval:phase21.schema",
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
    ...overrides,
  };
}

describe("Phase 21 vault taxonomy contracts", () => {
  it("exposes the approved top-level vault folders only", () => {
    expect(VAULT_ROOT_FOLDERS).toEqual([
      "00-meta",
      "01-inbox",
      "10-wiki",
      "20-projects",
      "30-research",
      "40-learning",
      "50-career",
      "60-agents",
      "70-references",
      "80-reviews",
      "90-archive",
      "_attachments",
    ]);
    expect(VAULT_ROOT_FOLDERS).not.toContain("10-daily");
    expect(VAULT_ROOT_FOLDERS).not.toContain("30-people");
    expect(VAULT_ROOT_FOLDERS).not.toContain("50-ideas");
  });

  it("exposes the approved LLM wiki child taxonomy", () => {
    expect(LLM_WIKI_FOLDERS).toEqual([
      "hubs",
      "concepts",
      "systems",
      "people",
      "projects",
      "sources",
      "decisions",
    ]);
  });

  it("registers the required note types and rejects unknown note types", () => {
    expect(VAULT_NOTE_TYPES).toEqual([
      "hub",
      "concept",
      "system",
      "person",
      "project",
      "source",
      "decision",
      "agent_run",
      "git_commit",
      "git_slice",
      "review",
      "inbox_item",
    ]);

    expect(
      VaultFrontmatterSchema.safeParse({
        ...note(),
        note_type: "daily",
      }).success,
    ).toBe(false);
  });
});

describe("Phase 21 vault frontmatter schema", () => {
  it("accepts minimal approved durable frontmatter", () => {
    expect(VaultFrontmatterSchema.parse(note())).toMatchObject({
      schema_version: 1,
      note_type: "concept",
      lifecycle: {
        durable: true,
        canonical: true,
        approval_status: "approved",
        approval_id: "approval:phase21.schema",
      },
    });
  });

  it("rejects durable notes without approval metadata", () => {
    const result = VaultFrontmatterSchema.safeParse(
      note({
        lifecycle: {
          durable: true,
          canonical: true,
          approval_status: "pending",
          approval_id: null,
          review_after: null,
          supersedes: [],
          superseded_by: [],
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("approval");
  });

  it("rejects direct durable agent notes that were not human approved", () => {
    const result = VaultFrontmatterSchema.safeParse(
      note({
        provenance: {
          source_type: "agent",
          source_id: "agent-output:1",
          source_url: null,
          content_hash: HASH,
        },
        agent: {
          created_by: "research-agent",
          run_id: "run:research.1",
          model_id: "local-model",
          promotion_status: "candidate",
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("human approval");
  });

  it("requires GitNexus note metadata to include a project", () => {
    expect(
      VaultFrontmatterSchema.safeParse(
        note({ note_type: "git_commit", project: null }),
      ).success,
    ).toBe(false);
  });
});

describe("Phase 21 vault routing contracts", () => {
  it.each([
    ["hub", "10-wiki/hubs"],
    ["concept", "10-wiki/concepts"],
    ["system", "10-wiki/systems"],
    ["person", "10-wiki/people"],
    ["project", "10-wiki/projects"],
    ["source", "10-wiki/sources"],
    ["decision", "10-wiki/decisions"],
  ] as const)("routes %s notes to the wiki taxonomy", (noteType, folder) => {
    expect(routeVaultNote(note({ note_type: noteType }))).toMatchObject({
      status: "routed",
      route_kind: "canonical",
      folder,
      durable_write_allowed: true,
      write_attempted: false,
    });
  });

  it("routes GitNexus notes under the project gitnexus namespace", () => {
    expect(
      routeVaultNote(
        note({
          note_type: "git_commit",
          domain: "project",
          project: "jarvis",
        }),
      ),
    ).toMatchObject({
      folder: "20-projects/jarvis/gitnexus/commits",
      route_kind: "derived_project",
    });

    expect(
      routeVaultNote(
        note({
          note_type: "git_slice",
          domain: "project",
          project: "jarvis",
        }),
      ),
    ).toMatchObject({
      folder: "20-projects/jarvis/gitnexus/slices",
      route_kind: "derived_project",
    });
  });

  it("routes transient agent outputs only to inbox or agent run folders", () => {
    const agent = {
      created_by: "research-agent",
      run_id: "run:research.1",
      model_id: "local-model",
      promotion_status: "transient" as const,
    };
    const transientLifecycle = {
      durable: false,
      canonical: false,
      approval_status: "not_required" as const,
      approval_id: null,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    };

    expect(
      routeVaultNote(
        note({
          id: "note:agent.run",
          note_type: "agent_run",
          domain: "agent",
          status: "draft",
          agent,
          lifecycle: transientLifecycle,
          provenance: {
            source_type: "agent",
            source_id: "agent-output:run",
            source_url: null,
            content_hash: HASH,
          },
        }),
      ).folder,
    ).toBe("60-agents/research-agent/runs");

    expect(
      routeVaultNote(
        note({
          id: "note:agent.inbox",
          note_type: "inbox_item",
          domain: "inbox",
          status: "draft",
          agent,
          lifecycle: transientLifecycle,
          provenance: {
            source_type: "agent",
            source_id: "agent-output:inbox",
            source_url: null,
            content_hash: HASH,
          },
        }),
      ).folder,
    ).toBe("01-inbox/agent");

    const transientGitNexus = routeVaultNote(
      note({
        id: "note:agent.git",
        note_type: "git_commit",
        domain: "project",
        status: "draft",
        project: "jarvis",
        agent,
        lifecycle: transientLifecycle,
        provenance: {
          source_type: "agent",
          source_id: "agent-output:git",
          source_url: null,
          content_hash: HASH,
        },
      }),
    );

    expect(transientGitNexus).toMatchObject({
      folder: "01-inbox/agent",
      route_kind: "inbox",
      durable_write_allowed: false,
      approved_for_durable_write: false,
      write_attempted: false,
    });
  });

  it("holds status-durable notes without lifecycle approval", () => {
    const decision = routeVaultNote(
      note({
        status: "active",
        lifecycle: {
          durable: false,
          canonical: false,
          approval_status: "pending",
          approval_id: null,
          review_after: null,
          supersedes: [],
          superseded_by: [],
        },
      }),
    );

    expect(decision).toMatchObject({
      status: "held_for_approval",
      route_kind: "pending_approval",
      folder: "01-inbox/pending-approval",
      durable_write_allowed: false,
      requires_librarian_review: true,
      write_attempted: false,
    });
    expect(decision.governance_reasons).toContain(
      "durable_note_requires_approval",
    );
  });

  it("keeps markdown canonical and derived indexes non-authoritative", () => {
    const decision = routeVaultNote(note());
    expect(decision.canonical_source).toBe("markdown");
    expect(decision.derived_indexes).toEqual(["sqlite", "vector", "graph"]);
    expect(decision.index_is_authoritative).toBe(false);
    expect(VAULT_CANONICAL_SOURCE_POLICY).toMatchObject({
      sqlite_index_derived: true,
      vector_index_derived: true,
      graph_index_derived: true,
      index_is_authoritative: false,
      vault_writes_allowed: false,
    });
  });

  it("sanitizes route path segments deterministically", () => {
    expect(slugPathSegment("../Jarvis Main!!")).toBe("jarvis-main");
    expect(slugPathSegment("\0")).toBe("unassigned");
  });
});

describe("Phase 21 vault governance tripwires", () => {
  it("keeps contract modules free of writes, watchers, network, and indexes", () => {
    const source = [
      "taxonomy.ts",
      "frontmatter.ts",
      "routing.ts",
      "write-gateway.ts",
    ]
      .map((file) =>
        readFileSync(join(process.cwd(), "src/lib/obsidian", file), "utf8"),
      )
      .join("\n");

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket)\b/,
    );
    expect(source).not.toMatch(
      /ensureVaultScaffold|writeVaultFileAtomically|memory\.note|src\/lib\/memory\/vault|src\\lib\\memory\\vault/,
    );
    expect(source).not.toMatch(
      /INSERT INTO|UPDATE\s+|DELETE FROM|sqliteVec|embedding|populate.*Vector|graph.*write/i,
    );
  });
});
