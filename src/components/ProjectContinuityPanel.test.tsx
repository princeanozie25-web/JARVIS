import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectStateRow } from "@/lib/db/node";
import { ProjectContinuityPanel } from "./ProjectContinuityPanel";

const project: ProjectStateRow = {
  project_id: "jarvis",
  project_name: "JARVIS",
  last_session_id: "session-1",
  last_action_summary: "Finished working memory assembly scaffold.",
  open_threads_json: JSON.stringify(["Phase 3C.5", "Read-only UI"]),
  next_intended_step: "Persist manual project state.",
  updated_at: 2_000,
};

describe("ProjectContinuityPanel", () => {
  it("renders project state read-only", () => {
    const html = renderToStaticMarkup(
      <ProjectContinuityPanel projects={[project]} />,
    );

    expect(html).toContain("Project Continuity");
    expect(html).toContain("1 projects");
    expect(html).toContain("JARVIS");
    expect(html).toContain("Finished working memory assembly scaffold.");
    expect(html).toContain("Persist manual project state.");
    expect(html).toContain("Phase 3C.5");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });

  it("shows an empty state", () => {
    const html = renderToStaticMarkup(
      <ProjectContinuityPanel projects={[]} loading={false} />,
    );

    expect(html).toContain("No project continuity stored yet.");
  });
});
