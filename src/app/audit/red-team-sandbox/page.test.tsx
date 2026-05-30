import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RedTeamSandboxPage from "./page";

const forbiddenRenderedAffordancePattern =
  /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i;

const forbiddenRenderedPayloadPattern =
  /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token|shell_command|executable_payload/i;

const forbiddenCaiControlPattern =
  /call cai|install cai|python sidecar|start sidecar|cai sidecar|cai execute|cai run/i;

describe("Phase 19D.4 audit red-team sandbox route", () => {
  it("/audit/red-team-sandbox renders the read-only red-team sandbox viewer", () => {
    const html = renderToStaticMarkup(<RedTeamSandboxPage />);

    expect(html).toContain('data-red-team-sandbox-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Red-Team Sandbox");
    expect(html).toContain("Allowed Target Scopes");
    expect(html).toContain("Forbidden Target Scopes");
    expect(html).toContain("Allowed Action Classes");
    expect(html).toContain("Forbidden Action Classes");
    expect(html).toContain("Sandbox Profiles");
    expect(html).toContain("Proposal Summaries");
    expect(html).toContain("Safety Violations and Warnings");
    expect(html).toContain("Search sandbox");
    expect(html).toContain("Target scope");
    expect(html).toContain("Action class");
    expect(html).toContain("Verdict");
    expect(html).toContain("Severity");
    expect(html).toContain("Inspect profile");
    expect(html).toContain("Inspect proposal");
    expect(html).toContain("Inspect warning");
    expect(html).toContain("Profile Inspection");
    expect(html).toContain("Proposal Inspection");
    expect(html).toContain("Warning Inspection");
    expect(html).toContain("CAI inactive");
    expect(html).not.toMatch(forbiddenCaiControlPattern);
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
    expect(html).not.toMatch(forbiddenRenderedPayloadPattern);
  });
});
