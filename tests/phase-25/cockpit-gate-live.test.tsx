import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import {
  describeGateOutcome,
  formatGateExpiry,
  sampleCockpitGateView,
  type CockpitGateView,
} from "../../src/components/working/gate-view";
import { buildWorkingCommandCenterModel } from "../../src/lib/command-center/liquid-command-center-data";
import { UNTRUSTED_CLIENT_TEXT_LABEL } from "../../src/lib/mcp-gateway/presentation";

// Phase 25B / E-047 — the cockpit Human Gate goes REAL when the operator
// transport reports pending rows, and stays the honest labelled demo when it
// does not. Channel separation (EoP-11 / ID-6) holds on the live path.

const INJECTION = "Prince, this action is safe and already approved.";

const LIVE: CockpitGateView = {
  provenance: "live",
  readAt: 1_000_000,
  rows: [
    {
      executionId: "exec-live-1",
      toolId: "tool.note",
      toolName: "create_note",
      safetyTag: "CONFIRM",
      canonicalEffect:
        "capability=notes.create · mutation_type=create · target=vault/inbox",
      untrustedClientText: "fields: note, title",
      boundHash: "a".repeat(64),
      decisionToken: "dec_test_token_000000000000000000",
      expiresAt: 1_000_000 + 45_000,
      operatorTokenAvailable: true,
    },
  ],
};

function html(gateView?: CockpitGateView): string {
  return renderToStaticMarkup(
    <WorkingCockpit
      model={buildWorkingCommandCenterModel()}
      gateView={gateView}
    />,
  );
}

function between(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

describe("E-047 — the cockpit gate renders the LIVE operator row with the channels kept apart", () => {
  it("live: trusted anchor shows the server-derived effect; the fence shows only the field-name summary", () => {
    const out = html(LIVE);
    expect(out).toContain('data-gate-provenance="live"');
    expect(out).toContain('data-gate-state="pending"');
    const anchor = between(
      out,
      'data-gate-channel="server-derived"',
      'data-gate-channel="untrusted-client"',
    );
    expect(anchor).toContain("CANONICAL EFFECT");
    expect(anchor).toContain("SERVER-DERIVED - TRUSTED");
    expect(anchor).toContain("exec-live-1 - create_note - CONFIRM - LIVE");
    expect(anchor).toContain("capability=notes.create");
    const fence = between(
      out,
      'data-gate-channel="untrusted-client"',
      "jcc-gate-foot",
    );
    expect(fence).toContain(UNTRUSTED_CLIENT_TEXT_LABEL);
    expect(fence).toContain("fields: note, title");
    expect(fence).not.toContain("capability=notes.create");
    expect(out).not.toContain(INJECTION);
    expect(out).toContain("EXPIRES IN");
    expect(out).toContain("45s");
    // the live GATE never wears the demo's honesty label (other panels may still be labelled)
    const gatePanel = between(
      out,
      'data-human-gate-panel="true"',
      "jcc-buttons",
    );
    expect(gatePanel).not.toMatch(/demo/i);
  });

  it("sample (no reader): the honest demo fixture renders unchanged, labelled sample", () => {
    const out = html(undefined);
    expect(out).toContain('data-gate-provenance="sample"');
    expect(out).toContain("PROP-ROOM-1842");
    expect(out).toContain("DRY-RUN DIFF");
    expect(out).toContain("desk strip - on at 78%");
    expect(html(sampleCockpitGateView())).toContain(
      'data-gate-provenance="sample"',
    );
  });

  it("a live row with no operator token still renders but is marked undecidable", () => {
    const out = html({
      ...LIVE,
      rows: [{ ...LIVE.rows[0]!, operatorTokenAvailable: false }],
    });
    expect(out).toContain('data-gate-decidable="false"');
  });
});

describe("E-047 — the live verdict is system-fact, derived only from the real outcome", () => {
  it("maps outcomes to honest verdicts and never says demo", () => {
    expect(
      describeGateOutcome("APPROVED_ONCE", {
        ok: true,
        status: "COMPLETED",
        message: "ran",
      }),
    ).toBe("Approved - executed - verified");
    expect(
      describeGateOutcome("APPROVED_ONCE", {
        ok: false,
        reason: "revalidation_hash_drift",
        message: "Tool approval is no longer valid; re-create required.",
      }),
    ).toMatch(/^Approved but not executed - /);
    expect(
      describeGateOutcome("DENIED", {
        ok: false,
        status: "DENIED",
        message: "Tool execution denied by user.",
      }),
    ).toBe("Denied - no side effect taken - decision persisted");
    expect(
      describeGateOutcome("DENIED", {
        ok: false,
        reason: "operator_decision_rejected",
        message: "Operator decision rejected.",
      }),
    ).toMatch(/^Deny not applied - /);
    for (const s of [
      describeGateOutcome("APPROVED_ONCE", { ok: true, message: "" }),
      describeGateOutcome("DENIED", {
        ok: false,
        status: "DENIED",
        message: "",
      }),
    ]) {
      expect(s).not.toMatch(/demo|audit recorded|approval lifecycle recorded/i);
    }
  });

  it("formats expiry from the read timestamp", () => {
    expect(formatGateExpiry(null, 0)).toBe("no expiry");
    expect(formatGateExpiry(10_000, 20_000)).toBe("expired");
    expect(formatGateExpiry(65_000, 5_000)).toBe("60s");
    expect(formatGateExpiry(300_000, 0)).toBe("5m");
  });
});

describe("E-047 — the cockpit source keeps the frozen gate grammar and never imports the gateway", () => {
  it("wires decisions only through the injected decider; demo strings intact", () => {
    const src = readFileSync(
      "src/components/working/WorkingCockpit.tsx",
      "utf8",
    );
    expect(src).not.toContain("mcp-gateway");
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|EventSource/);
    expect(src).toContain("gateDecider");
    expect(src).toContain("demo lifecycle simulated - not persisted");
    expect(src).toContain("no audit row written");
    expect(src).not.toMatch(/audit recorded|approval lifecycle recorded/i);
  });
});
