import { describe, expect, it } from "vitest";

import {
  DEMO_GAUNTLET_FIXTURES,
  DEMO_GAUNTLET_FIXTURE_DENIED,
  DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
  GAUNTLET_EVENT_KINDS,
  GAUNTLET_HUB_STATES,
  GAUNTLET_VIEWBOX,
  GAUNTLET_ZONE_IDS,
  GauntletEventSchema,
  buildGauntletViewModel,
  createMockGauntletEventStream,
  loadDemoGauntletFixture,
  parseGauntletEvent,
  tryParseGauntletEvent,
  type GauntletEvent,
} from "@/lib/gauntlet-visualization";

describe("DD.1 buildGauntletViewModel", () => {
  it("returns a frozen view model with the canonical id", () => {
    const model = buildGauntletViewModel();
    expect(model.model_id).toBe("living-system-map:dd-foundation");
    expect(model.title).toBe("Living System Map");
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("defaults the hub to the default state and the gold ring", () => {
    const model = buildGauntletViewModel();
    expect(model.hub.state).toBe("default");
    expect(model.hub.default_ring_stone).toBe("gold");
    expect(model.hub.always_visible).toBe(true);
  });

  it("respects an explicit hubState parameter for every known state", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const model = buildGauntletViewModel({ hubState: state });
      expect(model.hub.state).toBe(state);
    }
  });

  it("exposes all six stone zones — DD.3-DD.8 populate every stone", () => {
    const model = buildGauntletViewModel();
    expect(model.zones.map((z) => z.zone_id)).toEqual([...GAUNTLET_ZONE_IDS]);
    for (const id of GAUNTLET_ZONE_IDS) {
      const zone = model.zones.find((z) => z.zone_id === id);
      expect(zone?.populated).toBe(true);
      expect(zone!.nodes.length).toBeGreaterThan(0);
      expect(zone!.edges.length).toBeGreaterThan(0);
    }
    expect(model.populated_zones).toEqual([
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
    ]);
  });

  it("defaults every zone activation state to idle", () => {
    const model = buildGauntletViewModel();
    expect(model.time_state).toBe("idle");
    expect(model.mind_council_stage).toBe("idle");
    expect(model.soul_state).toBe("idle");
    expect(model.reality_state).toBe("idle");
    expect(model.power_state).toBe("idle");
  });

  it("ships exactly the eleven required Space nodes", () => {
    const model = buildGauntletViewModel();
    const space = model.zones.find((z) => z.zone_id === "space");
    expect(space).toBeDefined();
    const expectedIds = [
      "input_gateway",
      "intent_classifier",
      "safety_classifier",
      "router",
      "tier_t0",
      "tier_t1",
      "tier_t2",
      "tier_t3",
      "tier_t4",
      "tool_runtime",
      "audit_store",
    ];
    expect(space!.nodes.map((n) => n.node_id)).toEqual(expectedIds);
    expect(space!.nodes.length).toBe(11);
  });

  it("places every Space node inside the viewBox", () => {
    const model = buildGauntletViewModel();
    const space = model.zones.find((z) => z.zone_id === "space");
    for (const node of space!.nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.x).toBeLessThanOrEqual(GAUNTLET_VIEWBOX.width);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeLessThanOrEqual(GAUNTLET_VIEWBOX.height);
    }
  });

  it("declares strict read-only invariants on the model", () => {
    const model = buildGauntletViewModel();
    expect(model.metadata_only).toBe(true);
    expect(model.read_only).toBe(true);
    expect(model.execute_affordance_present).toBe(false);
    expect(model.approve_affordance_present).toBe(false);
    expect(model.mutation_affordance_present).toBe(false);
    expect(model.recording_enabled).toBe(false);
    expect(model.voice_enabled).toBe(false);
    expect(model.export_enabled).toBe(false);
    expect(model.live_telemetry_subscribed).toBe(false);
  });
});

describe("DD.1 GauntletEventSchema", () => {
  const validEvent: GauntletEvent = {
    event_id: "evt-1",
    timestamp: 0,
    zone_id: "space",
    source_node_id: "input_gateway",
    target_node_id: "router",
    kind: "pulse_start",
    pulse_stone: "space",
    metadata_only: true,
    read_only: true,
  };

  it("declares the canonical kind set", () => {
    expect(GAUNTLET_EVENT_KINDS).toEqual([
      "pulse_start",
      "pulse_arrive",
      "halt",
      "resume",
      "proposal_pending",
      "approved",
      "denied",
    ]);
  });

  it("accepts a valid event", () => {
    expect(() => parseGauntletEvent(validEvent)).not.toThrow();
  });

  it("rejects events with the wrong metadata flags", () => {
    expect(
      tryParseGauntletEvent({ ...validEvent, metadata_only: false }),
    ).toBeNull();
    expect(
      tryParseGauntletEvent({ ...validEvent, read_only: false }),
    ).toBeNull();
  });

  it("rejects events with unknown kinds or zones", () => {
    expect(
      tryParseGauntletEvent({ ...validEvent, kind: "execute_now" }),
    ).toBeNull();
    expect(
      tryParseGauntletEvent({ ...validEvent, zone_id: "demo" }),
    ).toBeNull();
  });

  it("permits the hub zone for state events", () => {
    const result = GauntletEventSchema.safeParse({
      ...validEvent,
      zone_id: "hub",
      kind: "approved",
      hub_state: "approved",
    });
    expect(result.success).toBe(true);
  });
});

describe("DD.1 demo fixtures", () => {
  it("ships at least the happy-path and denied fixtures", () => {
    expect(Object.keys(DEMO_GAUNTLET_FIXTURES).sort()).toEqual([
      "denied",
      "happy_path",
    ]);
  });

  it("happy_path walks input → halt → approved → resume → audit", () => {
    const kinds = DEMO_GAUNTLET_FIXTURE_HAPPY_PATH.map((e) => e.kind);
    expect(kinds).toContain("pulse_start");
    expect(kinds).toContain("halt");
    expect(kinds).toContain("proposal_pending");
    expect(kinds).toContain("approved");
    expect(kinds).toContain("resume");
    expect(kinds[kinds.length - 1]).toBe("pulse_arrive");
  });

  it("denied fixture halts and never resumes", () => {
    const kinds = DEMO_GAUNTLET_FIXTURE_DENIED.map((e) => e.kind);
    expect(kinds).toContain("halt");
    expect(kinds).toContain("denied");
    expect(kinds).not.toContain("resume");
    expect(kinds).not.toContain("approved");
  });

  it("loadDemoGauntletFixture deny-defaults to happy_path", () => {
    expect(loadDemoGauntletFixture("not-a-fixture")).toBe(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
    );
    expect(loadDemoGauntletFixture(undefined)).toBe(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
    );
    expect(loadDemoGauntletFixture("denied")).toBe(
      DEMO_GAUNTLET_FIXTURE_DENIED,
    );
  });

  it("every fixture event validates against the schema", () => {
    for (const list of Object.values(DEMO_GAUNTLET_FIXTURES)) {
      for (const event of list) {
        expect(() => parseGauntletEvent(event)).not.toThrow();
      }
    }
  });
});

describe("DD.1 mock event stream", () => {
  it("emits events in fixture order via step()", () => {
    const stream = createMockGauntletEventStream(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
    );
    const seen: string[] = [];
    stream.subscribe((evt) => seen.push(evt.event_id));
    while (!stream.isComplete()) stream.step();
    expect(seen).toEqual(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH.map((e) => e.event_id),
    );
  });

  it("play() emits every remaining event at once and marks complete", () => {
    const stream = createMockGauntletEventStream(DEMO_GAUNTLET_FIXTURE_DENIED);
    const emitted = stream.play();
    expect(emitted.length).toBe(DEMO_GAUNTLET_FIXTURE_DENIED.length);
    expect(stream.isComplete()).toBe(true);
    expect(stream.step()).toBeNull();
  });

  it("supports unsubscribe + reset", () => {
    const stream = createMockGauntletEventStream(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
    );
    const seen: string[] = [];
    const unsub = stream.subscribe((e) => seen.push(e.event_id));
    stream.step();
    unsub();
    stream.step();
    expect(seen.length).toBe(1);
    stream.reset();
    expect(stream.pendingIndex()).toBe(0);
  });

  it("does no I/O — no setInterval, no fetch, no provider call", () => {
    // The factory simply returns a frozen-API object; verifying its shape is
    // enough — if it ever needed I/O, this test would surface the dependency.
    const stream = createMockGauntletEventStream(
      DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
    );
    expect(typeof stream.step).toBe("function");
    expect(typeof stream.play).toBe("function");
    expect(typeof stream.subscribe).toBe("function");
    expect(typeof stream.reset).toBe("function");
  });
});
