import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import {
  buildWorkingCommandCenterModel,
  type SafeObservabilityHandle,
} from "../../src/lib/command-center/liquid-command-center-data";
import type { ObservabilityApi } from "../../src/lib/observability/contracts";

// Capstone honesty pass (slice 1) — the UI must not make live-LOOKING claims
// it cannot back: no fake "audit recorded", no stale test-count/phase literals,
// no fabricated cost split, and the ROOM/COST/ACTIVITY labels must reflect the
// ACTUAL data source at render (per-panel provenance), not a blanket marker.

const COCKPIT_SOURCE = readFileSync(
  "src/components/working/WorkingCockpit.tsx",
  "utf8",
);
const DATA_SOURCE = readFileSync(
  "src/lib/command-center/liquid-command-center-data.ts",
  "utf8",
);

function fakeApi(overrides: {
  providerBuckets?: readonly { key: string; count: number }[];
  withheld?: boolean;
}): ObservabilityApi {
  const withheld = overrides.withheld ?? false;
  return {
    queryRoomState: () => ({
      withheld,
      data: withheld
        ? null
        : {
            room_status: "focused",
            stale: false,
            summaries: [
              {
                room_id: "office",
                device_id: "desk-strip",
                sensor_id: null,
                capability: "light",
                status: "known",
              },
            ],
          },
    }),
    queryTelemetryRollups: () => ({
      withheld,
      data: withheld
        ? null
        : {
            model_calls_by_provider: overrides.providerBuckets ?? [
              { key: "local-llama", count: 3 },
              { key: "cloud-haiku", count: 1 },
            ],
            telemetry_by_severity: [{ key: "info", count: 2 }],
            telemetry_by_scope: [],
            runtime_by_status: [],
            errors: [],
          },
    }),
    queryRecentTraces: () => ({
      withheld,
      data: withheld
        ? null
        : {
            traces: [
              {
                replay_trace_id: "trace-1",
                occurred_at_ms: 1_783_000_000_000,
                trace_kind: "approval_resolved",
              },
            ],
          },
    }),
  } as unknown as ObservabilityApi;
}

function liveHandle(
  overrides: Parameters<typeof fakeApi>[0] = {},
): SafeObservabilityHandle {
  return { api: fakeApi(overrides), source: "live_db" };
}

describe("I-H1 — the demo gate makes no false audit claim", () => {
  it("the old persisted-audit wording is gone from the cockpit source", () => {
    expect(COCKPIT_SOURCE).not.toMatch(/audit recorded/i);
    expect(COCKPIT_SOURCE).not.toMatch(/approval lifecycle recorded/i);
  });

  it("the resolved-gate copy explicitly reads as demo / not persisted", () => {
    expect(COCKPIT_SOURCE).toContain("no audit row written");
    expect(COCKPIT_SOURCE).toContain(
      "demo lifecycle simulated - not persisted",
    );
    expect(COCKPIT_SOURCE).toContain("denied in the demo gate - not persisted");
  });

  it("the gate remains a demo (executionAvailable unchanged, false)", () => {
    expect(buildWorkingCommandCenterModel().proposal.executionAvailable).toBe(
      false,
    );
  });
});

describe("I-H2 — no stale live-looking literals", () => {
  it("the stale test count and phase string are gone from both sources", () => {
    for (const source of [COCKPIT_SOURCE, DATA_SOURCE]) {
      expect(source).not.toContain("4,930");
      expect(source).not.toContain("Phase 21 active");
    }
  });

  it("test count and phase are non-staling labels, not counts", () => {
    const model = buildWorkingCommandCenterModel();
    expect(model.testCount).toBe("full suite gated in-hook");
    expect(model.testCount).not.toMatch(/\d/);
    expect(model.phase).toBe("Expansion Era - post-Phase-24");
  });

  it("the hardcoded 76% cost-split fallback is gone; zero provider data renders 'no cost data'", () => {
    expect(DATA_SOURCE).not.toMatch(/\?\s*76\s*:/);
    const model = buildWorkingCommandCenterModel(
      liveHandle({ providerBuckets: [] }),
    );
    const local = model.cost.find((metric) => metric.label === "LOCAL");
    const cloud = model.cost.find((metric) => metric.label === "CLOUD");
    expect(local?.value).toBe("no cost data");
    expect(cloud?.value).toBe("no cost data");
  });

  it("a real provider split is still derived when data exists", () => {
    const model = buildWorkingCommandCenterModel(
      liveHandle({
        providerBuckets: [
          { key: "local-llama", count: 3 },
          { key: "cloud-haiku", count: 1 },
        ],
      }),
    );
    expect(model.cost.find((metric) => metric.label === "LOCAL")?.value).toBe(
      "75%",
    );
    expect(model.cost.find((metric) => metric.label === "CLOUD")?.value).toBe(
      "25%",
    );
  });
});

describe("I-H3 — per-panel provenance matches the actual source at render", () => {
  it("reports live for all three panels when a real observability DB backs the rows", () => {
    const model = buildWorkingCommandCenterModel(liveHandle());
    expect(model.provenance).toEqual({
      room: "live",
      cost: "live",
      activity: "live",
    });
  });

  it("reports synthetic when the rows come from the synthetic readers", () => {
    const model = buildWorkingCommandCenterModel({
      api: fakeApi({}),
      source: "synthetic_readers",
    });
    expect(model.provenance).toEqual({
      room: "synthetic",
      cost: "synthetic",
      activity: "synthetic",
    });
  });

  it("reports synthetic when a live DB withholds and the fixture fallback renders", () => {
    const model = buildWorkingCommandCenterModel({
      api: fakeApi({ withheld: true }),
      source: "live_db",
    });
    expect(model.provenance).toEqual({
      room: "synthetic",
      cost: "synthetic",
      activity: "synthetic",
    });
    // The fixture rows still render — labelled honestly.
    expect(model.room.length).toBeGreaterThan(0);
  });

  it("renders the provenance on each panel (label + data attribute)", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/data-panel-provenance="synthetic"/g)).toHaveLength(3);
    expect(html).toContain("OBSERVABILITY - SYNTHETIC");

    const liveHtml = renderToStaticMarkup(
      <WorkingCockpit model={buildWorkingCommandCenterModel(liveHandle())} />,
    );
    expect(liveHtml.match(/data-panel-provenance="live"/g)).toHaveLength(3);
    expect(liveHtml).toContain("OBSERVABILITY - LIVE");
  });
});

describe("I-H5 — labels only: no behavioral change, no mutation surface", () => {
  it("neither touched source references runTool or gains a data-source import", () => {
    for (const source of [COCKPIT_SOURCE, DATA_SOURCE]) {
      expect(source).not.toContain("runTool");
    }
    expect(COCKPIT_SOURCE).not.toMatch(
      /fetch\(|better-sqlite3|@\/lib\/db|approval-runtime/,
    );
  });
});
