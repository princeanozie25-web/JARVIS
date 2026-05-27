import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isWakeWordTerminalState,
  transitionWakeWordState,
} from "../../../src/lib/voice-runtime/wake-word";

const sourceRoot = join(process.cwd(), "src/lib/voice-runtime/wake-word");

describe("wake-word state machine scaffold", () => {
  it("supports the governed happy-path lifecycle without detection logic", () => {
    expect(transitionWakeWordState("disabled", "enable")).toMatchObject({
      ok: true,
      next_state: "available",
    });
    expect(transitionWakeWordState("available", "arm")).toMatchObject({
      ok: true,
      next_state: "armed",
    });
    expect(transitionWakeWordState("armed", "begin_detection")).toMatchObject({
      ok: true,
      next_state: "detecting",
    });
    expect(transitionWakeWordState("detecting", "wake_detected")).toMatchObject(
      {
        ok: true,
        next_state: "wake_detected",
      },
    );
    expect(
      transitionWakeWordState("wake_detected", "open_activation_window", {
        activation_window_ms: 5000,
      }),
    ).toEqual({
      ok: true,
      previous_state: "wake_detected",
      event: "open_activation_window",
      next_state: "activation_window",
      activation_window_ms: 5000,
      metadata_only: true,
    });
    expect(
      transitionWakeWordState("activation_window", "expire"),
    ).toMatchObject({
      ok: true,
      next_state: "expired",
    });
    expect(transitionWakeWordState("expired", "reset")).toMatchObject({
      ok: true,
      next_state: "available",
    });
  });

  it("fails closed on invalid states, events, and transitions", () => {
    expect(transitionWakeWordState("bogus", "enable")).toEqual({
      ok: false,
      previous_state: null,
      event: null,
      next_state: null,
      reason: "invalid_state",
      metadata_only: true,
    });
    expect(transitionWakeWordState("disabled", "bogus")).toEqual({
      ok: false,
      previous_state: "disabled",
      event: null,
      next_state: null,
      reason: "invalid_event",
      metadata_only: true,
    });
    expect(transitionWakeWordState("disabled", "begin_detection")).toEqual({
      ok: false,
      previous_state: "disabled",
      event: "begin_detection",
      next_state: null,
      reason: "invalid_transition",
      metadata_only: true,
    });
    expect(transitionWakeWordState("detecting", "reset")).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("requires a bounded activation window before entering activation_window", () => {
    expect(
      transitionWakeWordState("wake_detected", "open_activation_window"),
    ).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
    expect(
      transitionWakeWordState("wake_detected", "open_activation_window", {
        activation_window_ms: 30_001,
      }),
    ).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("supports cancellation from armed, detecting, and activation states", () => {
    expect(transitionWakeWordState("armed", "cancel")).toMatchObject({
      ok: true,
      next_state: "cancelled",
    });
    expect(transitionWakeWordState("detecting", "cancel")).toMatchObject({
      ok: true,
      next_state: "cancelled",
    });
    expect(
      transitionWakeWordState("activation_window", "cancel"),
    ).toMatchObject({
      ok: true,
      next_state: "cancelled",
    });
  });

  it("allows reset only from terminal states", () => {
    expect(isWakeWordTerminalState("expired")).toBe(true);
    expect(isWakeWordTerminalState("cancelled")).toBe(true);
    expect(isWakeWordTerminalState("failed")).toBe(true);
    expect(transitionWakeWordState("cancelled", "reset")).toMatchObject({
      ok: true,
      next_state: "available",
    });
    expect(transitionWakeWordState("armed", "reset")).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("does not contain active wake-word engine or background listening code", () => {
    const source = ["state-machine.ts", "types.ts"]
      .map((fileName) => readFileSync(join(sourceRoot, fileName), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/openwakeword|Porcupine|Picovoice|snowboy/i);
    expect(source).not.toMatch(/getUserMedia|MediaRecorder|AudioContext/i);
    expect(source).not.toMatch(/setInterval|while\s*\(true\)/i);
  });
});
