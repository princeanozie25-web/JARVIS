import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LongTermMemoryRow } from "@/lib/memory/types";
import { MemoryInspectorPanel } from "./MemoryInspectorPanel";

const row: LongTermMemoryRow = {
  id: "mem-1",
  category: "fact",
  content: "JARVIS Phase 3A has a read-only inspector.",
  source: "user",
  source_id: "session-1",
  project: "jarvis",
  tags_json: JSON.stringify(["#phase3"]),
  sensitivity: "personal",
  created_at: 1_000,
  updated_at: 1_000,
  obsidian_path: "50-ideas/test.md",
  hash: "sha256:test",
  status: "active",
};

describe("MemoryInspectorPanel", () => {
  it("renders memory rows read-only", () => {
    const html = renderToStaticMarkup(
      <MemoryInspectorPanel memories={[row]} vaultRoot="C:\\vault" />,
    );

    expect(html).toContain("Memory Inspector");
    expect(html).toContain("1 rows");
    expect(html).toContain("JARVIS Phase 3A has a read-only inspector.");
    expect(html).toContain("vault: 50-ideas/test.md");
  });

  it("shows an empty state", () => {
    const html = renderToStaticMarkup(
      <MemoryInspectorPanel memories={[]} vaultRoot={null} />,
    );

    expect(html).toContain("No memories stored yet.");
  });
});
