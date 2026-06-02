import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPANSION_ERA_AGENT_IDS,
  EXPANSION_ERA_AGENT_REGISTRY,
  getAgentRegistry,
  getAgentRegistryEntry,
  validateAgentRegistry,
} from ".";

describe("Expansion Era Agent Registry", () => {
  it("registers every Phase 21H agent exactly once", () => {
    const registry = getAgentRegistry();
    const ids = registry.entries.map((entry) => entry.id);

    expect(ids).toEqual([...EXPANSION_ERA_AGENT_IDS]);
    expect(new Set(ids).size).toBe(EXPANSION_ERA_AGENT_IDS.length);
    expect(validateAgentRegistry(registry)).toMatchObject({
      valid: true,
      reasons: ["valid_registry"],
      entry_count: EXPANSION_ERA_AGENT_IDS.length,
    });
  });

  it("declares source and output permissions for each agent", () => {
    for (const entry of EXPANSION_ERA_AGENT_REGISTRY.entries) {
      expect(entry.declared_sources.length).toBeGreaterThan(0);
      expect(entry.allowed_source_kinds).toEqual([
        ...new Set(entry.declared_sources.map((source) => source.source_kind)),
      ]);
      expect(entry.allowed_output_types).toContain(entry.output_type);
      expect(
        entry.declared_sources.every((source) => !source.raw_body_allowed),
      ).toBe(true);
      expect(
        entry.declared_sources.every((source) => !source.write_access_allowed),
      ).toBe(true);
      expect(
        entry.declared_sources.every((source) => !source.network_call_allowed),
      ).toBe(true);
    }
  });

  it("assigns authority classes without execution authority", () => {
    const registry = getAgentRegistry();
    const authorityByAgent = Object.fromEntries(
      registry.entries.map((entry) => [entry.id, entry.authority]),
    );

    expect(authorityByAgent).toMatchObject({
      life_coach: "proposal_only",
      build_monitor: "suggest_only",
      research_agent: "suggest_only",
      cv_maintenance: "proposal_only",
      application_tracker: "proposal_only",
      deadline_agent: "suggest_only",
      cost_monitor: "observe_only",
      health_agent: "suggest_only",
    });
    for (const entry of registry.entries) {
      expect(entry.execution_authority).toBe(false);
      expect(entry.governance.execution_authority).toBe(false);
      expect(entry.governance.scheduler_implementation_enabled).toBe(false);
      expect(entry.live_calls_allowed).toBe(false);
    }
  });

  it("routes every registry output to Suggestion Inbox", () => {
    for (const entry of EXPANSION_ERA_AGENT_REGISTRY.entries) {
      expect(entry.output_destination).toBe("suggestion_inbox");
      expect(entry.inbox_target).toBe("suggestion_inbox");
      expect(entry.governance.suggestion_inbox_required).toBe(true);
      expect(entry.suggestions_created).toBe(false);
    }
  });

  it("requires proposal agents to use approval lifecycle and verification metadata", () => {
    const proposalAgents = EXPANSION_ERA_AGENT_REGISTRY.entries.filter(
      (entry) => entry.authority === "proposal_only",
    );

    expect(proposalAgents.map((entry) => entry.id)).toEqual([
      "life_coach",
      "cv_maintenance",
      "application_tracker",
    ]);
    for (const entry of proposalAgents) {
      expect(entry.requires_approval).toBe(true);
      expect(entry.requires_verification).toBe(true);
      expect(entry.governance.approval_lifecycle_required_for_proposals).toBe(
        true,
      );
    }
  });

  it("has no cross-agent source declaration", () => {
    for (const entry of EXPANSION_ERA_AGENT_REGISTRY.entries) {
      expect(entry.allowed_source_kinds).not.toContain("agent_output");
      expect(
        entry.declared_sources.every(
          (source) => source.cross_agent_read_allowed === false,
        ),
      ).toBe(true);
    }
  });

  it("rejects invalid registry shapes and unsafe mutations", () => {
    const missing = validateAgentRegistry({
      ...EXPANSION_ERA_AGENT_REGISTRY,
      entries: EXPANSION_ERA_AGENT_REGISTRY.entries.slice(1),
    });
    expect(missing.valid).toBe(false);
    expect(missing.reasons).toContain("invalid_registry");

    expect(() => getAgentRegistryEntry("unknown_agent" as never)).toThrow(
      "unknown agent registry entry",
    );
  });

  it("has no execution, scheduling, model, Google, GitHub, vault, or background wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/registry.ts"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/index.ts"),
      "utf8",
    );

    for (const text of [source, index]) {
      expect(text).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(text).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(text).not.toMatch(
        /fetch\s*\(|googleapis|octokit|readGmail|readCalendar|readDrive/i,
      );
      expect(text).not.toMatch(
        /DeepSeek|Ollama|OpenAI|Anthropic|modelRuntime/i,
      );
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/from\s+["'].*approval-runtime/i);
      expect(text).not.toMatch(/from\s+["'].*routines/i);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});
