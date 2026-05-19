import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoalRow } from "@/lib/db/node";
import { GoalContinuityPanel } from "./GoalContinuityPanel";

const activeGoal: GoalRow = {
  id: "goal-1",
  title: "Finish Phase 3D goals.",
  status: "active",
  parent_id: null,
  created_at: 2_000,
  last_touched: 3_000,
  completed_at: null,
  source: "user",
};

const closedGoal: GoalRow = {
  id: "goal-2",
  title: "Close Phase 3D consent manifest.",
  status: "met",
  parent_id: "goal-1",
  created_at: 1_000,
  last_touched: 2_000,
  completed_at: 2_000,
  source: "user",
};

describe("GoalContinuityPanel", () => {
  it("renders creation form, active goals, closed goals, and status controls", () => {
    const html = renderToStaticMarkup(
      <GoalContinuityPanel
        goals={[activeGoal, closedGoal]}
        consentEnabled
        onCreate={() => undefined}
        onUpdateStatus={() => undefined}
        onTouch={() => undefined}
      />,
    );

    expect(html).toContain("Goal Continuity");
    expect(html).toContain("Create Goal");
    expect(html).toContain("Active Goals");
    expect(html).toContain("Closed Goals");
    expect(html).toContain("Finish Phase 3D goals.");
    expect(html).toContain("Close Phase 3D consent manifest.");
    expect(html).toContain("parent goal-1");
    expect(html).toContain("Status for Finish Phase 3D goals.");
    expect(html).toContain("Touch");
  });

  it("shows disabled consent state", () => {
    const html = renderToStaticMarkup(
      <GoalContinuityPanel
        goals={[]}
        consentEnabled={false}
        onCreate={() => undefined}
        onUpdateStatus={() => undefined}
        onTouch={() => undefined}
      />,
    );

    expect(html).toContain("Goals are disabled until consent is enabled.");
    expect(html).toContain("No active goals stored.");
    expect(html).toContain("No met, missed, or abandoned goals stored.");
  });
});
