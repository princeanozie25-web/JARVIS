import { describe, expect, it } from "vitest";

import {
  IDLE_ORB_ACTIVITY_DESCRIPTOR,
  ORB_ACTIVITY_DESCRIPTORS,
  ORB_ACTIVITY_STATES,
  resolveOrbActivityState,
  type OrbActivityState,
  type OrbSemanticTone,
} from "./activity-states";

const ALLOWED_SEMANTIC: ReadonlySet<OrbSemanticTone> = new Set([
  "signal",
  "focus",
  "local",
  "review",
  "blocked",
]);

const ALLOWED_TONES = new Set(["quiet", "focused", "review", "withheld"]);
const ALLOWED_ANIMATIONS = new Set([
  "breathing",
  "pulse-fast",
  "sweep",
  "rhythmic",
  "scan",
  "pulse-orange",
  "pulse-red",
]);

describe("UI.6 orb state machine — descriptors", () => {
  it("covers all seven activity states", () => {
    expect(ORB_ACTIVITY_STATES).toEqual([
      "idle",
      "listening",
      "processing",
      "speaking",
      "systems_healthy",
      "approval_needed",
      "alert",
    ]);
    for (const state of ORB_ACTIVITY_STATES) {
      expect(ORB_ACTIVITY_DESCRIPTORS).toHaveProperty(state);
    }
  });

  it("uses only semantic governance tones, never raw hex", () => {
    for (const state of ORB_ACTIVITY_STATES) {
      const descriptor = ORB_ACTIVITY_DESCRIPTORS[state];
      expect(ALLOWED_SEMANTIC.has(descriptor.semantic)).toBe(true);
      expect(ALLOWED_TONES.has(descriptor.tone)).toBe(true);
      expect(ALLOWED_ANIMATIONS.has(descriptor.animation)).toBe(true);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.detail.length).toBeGreaterThan(0);
    }
  });

  it("maps each state's semantic tone to the expected governance role", () => {
    const expected: Record<OrbActivityState, OrbSemanticTone> = {
      idle: "signal",
      listening: "focus",
      processing: "focus",
      speaking: "focus",
      systems_healthy: "local",
      approval_needed: "review",
      alert: "blocked",
    };
    for (const state of ORB_ACTIVITY_STATES) {
      expect(ORB_ACTIVITY_DESCRIPTORS[state].semantic).toBe(expected[state]);
    }
  });

  it("uses a distinct animation per behavior in the brief", () => {
    expect(ORB_ACTIVITY_DESCRIPTORS.idle.animation).toBe("breathing");
    expect(ORB_ACTIVITY_DESCRIPTORS.listening.animation).toBe("pulse-fast");
    expect(ORB_ACTIVITY_DESCRIPTORS.processing.animation).toBe("sweep");
    expect(ORB_ACTIVITY_DESCRIPTORS.speaking.animation).toBe("rhythmic");
    expect(ORB_ACTIVITY_DESCRIPTORS.systems_healthy.animation).toBe("scan");
    expect(ORB_ACTIVITY_DESCRIPTORS.approval_needed.animation).toBe(
      "pulse-orange",
    );
    expect(ORB_ACTIVITY_DESCRIPTORS.alert.animation).toBe("pulse-red");
  });
});

describe("UI.6 orb state machine — resolver", () => {
  it("returns the descriptor for every known state", () => {
    for (const state of ORB_ACTIVITY_STATES) {
      expect(resolveOrbActivityState(state)).toBe(
        ORB_ACTIVITY_DESCRIPTORS[state],
      );
    }
  });

  it("falls back to idle for unknown strings without throwing", () => {
    expect(() => resolveOrbActivityState("unknown")).not.toThrow();
    expect(resolveOrbActivityState("definitely-not-a-state")).toBe(
      IDLE_ORB_ACTIVITY_DESCRIPTOR,
    );
  });

  it("falls back to idle for non-string inputs (null, undefined, object, number)", () => {
    expect(resolveOrbActivityState(undefined)).toBe(
      IDLE_ORB_ACTIVITY_DESCRIPTOR,
    );
    expect(resolveOrbActivityState(null)).toBe(IDLE_ORB_ACTIVITY_DESCRIPTOR);
    expect(resolveOrbActivityState({})).toBe(IDLE_ORB_ACTIVITY_DESCRIPTOR);
    expect(resolveOrbActivityState(42)).toBe(IDLE_ORB_ACTIVITY_DESCRIPTOR);
  });

  it("freezes descriptors so consumers cannot mutate them", () => {
    expect(Object.isFrozen(ORB_ACTIVITY_DESCRIPTORS)).toBe(true);
  });
});
