import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RedTeamSandboxViewer,
  buildRedTeamSandboxViewerModel,
  buildRedTeamSandboxViewerState,
  filterRedTeamSandboxViewerProfiles,
  filterRedTeamSandboxViewerProposals,
  filterRedTeamSandboxViewerViolations,
} from "./RedTeamSandboxViewer";

const COMPONENT_SOURCE =
  "src/components/red-team-sandbox/RedTeamSandboxViewer.tsx";

const forbiddenRenderedAffordancePattern =
  /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i;

const forbiddenRenderedPayloadPattern =
  /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token|shell_command|executable_payload/i;

const forbiddenCaiControlPattern =
  /call cai|install cai|python sidecar|start sidecar|cai sidecar|cai execute|cai run/i;

function renderViewer() {
  return renderToStaticMarkup(<RedTeamSandboxViewer />);
}

describe("Phase 19D.4 red-team sandbox inspection and filtering", () => {
  it("renders the visible read-only red-team sandbox route surface", () => {
    const html = renderViewer();

    expect(html).toContain('data-red-team-sandbox-viewer="read-only"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-read-only="true"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Red-Team Sandbox");
    expect(html).toContain("Phase 19D governed sandbox");
    expect(html).toContain("Sandbox status");
    expect(html).toContain("inactive");
    expect(html).toContain("Search sandbox");
    expect(html).toContain("Target scope");
    expect(html).toContain("Action class");
    expect(html).toContain("Verdict");
    expect(html).toContain("Severity");
  });

  it("renders allowed and forbidden target scopes", () => {
    const html = renderViewer();

    expect(html).toContain("Allowed Target Scopes");
    expect(html).toContain("localhost only");
    expect(html).toContain("repo static analysis only");
    expect(html).toContain("synthetic fixture only");
    expect(html).toContain("Forbidden Target Scopes");
    expect(html).toContain("public internet");
    expect(html).toContain("private LAN");
    expect(html).toContain("credentialed external system");
  });

  it("renders allowed and forbidden action classes", () => {
    const html = renderViewer();

    expect(html).toContain("Allowed Action Classes");
    expect(html).toContain("read-only reconnaissance");
    expect(html).toContain("static analysis");
    expect(html).toContain("dependency inventory");
    expect(html).toContain("Forbidden Action Classes");
    expect(html).toContain("exploit payload class");
    expect(html).toContain("credential attack");
    expect(html).toContain("destructive action");
    expect(html).toContain("external network probe");
  });

  it("renders sandbox profiles and disabled capability indicators", () => {
    const html = renderViewer();

    expect(html).toContain("Sandbox Profiles");
    expect(html).toContain("Phase 19D Local Red-Team Sandbox");
    expect(html).toContain("Allowed scopes");
    expect(html).toContain("Denied scopes");
    expect(html).toContain("CAI inactive");
    expect(html).toContain("Sidecar absent");
    expect(html).toContain("Command use off");
    expect(html).toContain("External probing off");
    expect(html).toContain("Authority materials off");
    expect(html).toContain("Show Disabled Capabilities");
  });

  it("renders safe and denied proposal summaries", () => {
    const html = renderViewer();

    expect(html).toContain("Proposal Summaries");
    expect(html).toContain("Safe localhost static analysis proposal");
    expect(html).toContain("allowed metadata only");
    expect(html).toContain("Denied public internet proposal");
    expect(html).toContain("Denied destructive action proposal");
    expect(html).toContain("denied only");
    expect(html).toContain("Preview first");
    expect(html).toContain("Approval metadata");
    expect(html).toContain("present");
    expect(html).toContain("Inspect proposal");
  });

  it("renders safety violations and warnings as denied-only metadata", () => {
    const html = renderViewer();

    expect(html).toContain("Safety Violations and Warnings");
    expect(html).toContain("forbidden target scope");
    expect(html).toContain("forbidden action class");
    expect(html).toContain("denied only");
    expect(html).toContain("Inspect warning");
  });

  it("renders profile, proposal, and warning detail panels", () => {
    const html = renderViewer();

    expect(html).toContain('data-red-team-profile-detail="read-only"');
    expect(html).toContain("Profile Inspection");
    expect(html).toContain("Allowed scopes");
    expect(html).toContain("Forbidden scopes");
    expect(html).toContain("Allowed action classes");
    expect(html).toContain("Forbidden action classes");
    expect(html).toContain("Phase 18 metadata");
    expect(html).toContain("Target whitelist");
    expect(html).toContain("Disabled capabilities");
    expect(html).toContain('data-red-team-proposal-detail="read-only"');
    expect(html).toContain("Proposal Inspection");
    expect(html).toContain("Approval metadata state");
    expect(html).toContain("Preview state");
    expect(html).toContain("Audit preview");
    expect(html).toContain("Payload material");
    expect(html).toContain('data-red-team-violation-detail="read-only"');
    expect(html).toContain("Warning Inspection");
    expect(html).toContain("Violation kind");
    expect(html).toContain("Field name");
    expect(html).toContain("Redacted sample");
    expect(html).toContain("Sample class");
    expect(html).toContain("Recommendation");
  });

  it("uses the red-team sandbox safety guard before rendering", () => {
    const model = buildRedTeamSandboxViewerModel();
    const source = readFileSync(COMPONENT_SOURCE, "utf8");

    expect(model.projection_safety_checked).toBe(true);
    expect(model.metadata_only).toBe(true);
    expect(model.read_only).toBe(true);
    expect(
      model.proposals.find((proposal) =>
        proposal.proposal_id.includes("denied-public-internet"),
      )?.violation_count,
    ).toBeGreaterThan(0);
    expect(
      model.proposals.find((proposal) =>
        proposal.proposal_id.includes("denied-destructive"),
      )?.verdict_label,
    ).toBe("denied only");
    expect(source).toContain("assertRedTeamSandboxSafe(model)");
    expect(source).toContain("scanRedTeamSandboxSafety(model");
  });

  it("builds selected detail state as read-only metadata", () => {
    const model = buildRedTeamSandboxViewerModel();
    const selectedViolation = model.violations.find(
      (violation) =>
        violation.proposal_id ===
        "red-team-proposal:denied-public-internet-scan",
    );
    const state = buildRedTeamSandboxViewerState(model, {
      selectedProfileId: "red-team-profile:phase-19d-local-sandbox",
      selectedProposalId: "red-team-proposal:denied-public-internet-scan",
      selectedViolationId: selectedViolation?.violation_id,
    });

    expect(state.selected_profile.label).toBe(
      "Phase 19D Local Red-Team Sandbox",
    );
    expect(state.selected_profile.authorization_summary).toMatchObject({
      phase_18_approval_metadata: "required",
      preview_first: "required",
      target_whitelist: "required",
      authority_grant: "blocked",
      metadata_only: true,
      read_only: true,
    });
    expect(state.selected_proposal).toMatchObject({
      proposal_id: "red-team-proposal:denied-public-internet-scan",
      verdict_label: "denied only",
      metadata_only: true,
      read_only: true,
    });
    expect(state.selected_proposal.audit_preview_summary).toMatchObject({
      verdict_label: "denied only",
      approval_required: true,
      preview_first_required: true,
      raw_payload_included: false,
      metadata_only: true,
      read_only: true,
    });
    expect(state.selected_violation).toMatchObject({
      denied_only: true,
      metadata_only: true,
      read_only: true,
    });
  });

  it("filters by target scope, action class, verdict, and severity", () => {
    const model = buildRedTeamSandboxViewerModel();

    expect(
      filterRedTeamSandboxViewerProposals(model, {
        targetScopeFilter: "public internet",
        actionClassFilter: "all",
        verdictFilter: "all",
        showDeniedExamples: true,
        searchQuery: "",
      }).map((proposal) => proposal.label),
    ).toEqual(["Denied public internet proposal"]);
    expect(
      filterRedTeamSandboxViewerProposals(model, {
        targetScopeFilter: "all",
        actionClassFilter: "destructive action",
        verdictFilter: "all",
        showDeniedExamples: true,
        searchQuery: "",
      }).map((proposal) => proposal.label),
    ).toEqual(["Denied destructive action proposal"]);
    expect(
      filterRedTeamSandboxViewerProposals(model, {
        targetScopeFilter: "all",
        actionClassFilter: "all",
        verdictFilter: "allowed metadata only",
        showDeniedExamples: true,
        searchQuery: "",
      }).map((proposal) => proposal.label),
    ).toEqual(["Safe localhost static analysis proposal"]);
    expect(
      filterRedTeamSandboxViewerViolations(model, {
        severityFilter: "error",
        showDeniedExamples: true,
        searchQuery: "",
      }),
    ).toHaveLength(model.violations.length);
  });

  it("searches profile, proposal, and warning labels without mutating source data", () => {
    const model = buildRedTeamSandboxViewerModel();
    const before = JSON.stringify(model);

    expect(
      filterRedTeamSandboxViewerProfiles(model, "local").map(
        (profile) => profile.label,
      ),
    ).toEqual(["Phase 19D Local Red-Team Sandbox"]);
    expect(
      filterRedTeamSandboxViewerProposals(model, {
        targetScopeFilter: "all",
        actionClassFilter: "all",
        verdictFilter: "all",
        showDeniedExamples: true,
        searchQuery: "public",
      }).map((proposal) => proposal.label),
    ).toEqual(["Denied public internet proposal"]);
    expect(
      filterRedTeamSandboxViewerViolations(model, {
        severityFilter: "all",
        showDeniedExamples: true,
        searchQuery: "forbidden action",
      }).length,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("keeps denied examples and disabled capabilities as indicators only", () => {
    const model = buildRedTeamSandboxViewerModel();
    const state = buildRedTeamSandboxViewerState(model, {
      showDeniedExamples: false,
      showDisabledCapabilities: false,
    });

    expect(
      state.visible_proposals.every(
        (proposal) => proposal.verdict_label !== "denied only",
      ),
    ).toBe(true);
    expect(state.visible_violations).toHaveLength(0);
    expect(state.show_disabled_capabilities).toBe(false);
  });

  it("renders no CAI controls, forbidden action labels, or raw payload fields", () => {
    const html = renderViewer();

    expect(html).not.toMatch(forbiddenCaiControlPattern);
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
    expect(html).not.toMatch(forbiddenRenderedPayloadPattern);
    expect(html).not.toMatch(/<form\b|<a\b/i);
  });
});
