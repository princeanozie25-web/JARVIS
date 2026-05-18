import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RollbackSummary } from "@/lib/rollbacks/visibility";
import { RollbackStatusPanel } from "./RollbackStatusPanel";

const latest: RollbackSummary = {
  id: "rollback-1",
  kind: "fs_unlink_created",
  created_at: 1_000,
  applied_at: null,
  expires_at: 2_000,
  expiry_status: "available",
  available: true,
  path_summary: "hello.txt",
  source_tool_call_id: "exec-1",
};

describe("RollbackStatusPanel", () => {
  it("shows undo availability and action summary", () => {
    const html = renderToStaticMarkup(
      <RollbackStatusPanel latest={latest} onUndo={() => undefined} />,
    );

    expect(html).toContain("Undo available");
    expect(html).toContain("Undo last file create: hello.txt");
    expect(html).toContain("Ask JARVIS to undo");
  });

  it("renders nothing when latest is unavailable", () => {
    const html = renderToStaticMarkup(
      <RollbackStatusPanel latest={null} onUndo={() => undefined} />,
    );

    expect(html).toBe("");
  });

  it("shows append undo summaries", () => {
    const html = renderToStaticMarkup(
      <RollbackStatusPanel
        latest={{
          ...latest,
          kind: "fs_truncate_to_length",
          path_summary: "notes.txt",
        }}
        onUndo={() => undefined}
      />,
    );

    expect(html).toContain("Undo last file append: notes.txt");
  });

  it("shows directory create undo summaries", () => {
    const html = renderToStaticMarkup(
      <RollbackStatusPanel
        latest={{
          ...latest,
          kind: "fs_rmdir_empty",
          path_summary: "new-folder",
        }}
        onUndo={() => undefined}
      />,
    );

    expect(html).toContain("Undo last directory create: new-folder");
  });

  it("shows memory note undo summaries", () => {
    const html = renderToStaticMarkup(
      <RollbackStatusPanel
        latest={{
          ...latest,
          kind: "memory_delete_created",
          path_summary: "50-ideas/test.md",
        }}
        onUndo={() => undefined}
      />,
    );

    expect(html).toContain("Undo last memory note: 50-ideas/test.md");
  });
});
