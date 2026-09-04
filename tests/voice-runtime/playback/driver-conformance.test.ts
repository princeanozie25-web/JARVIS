// E-024 (runway R.2) — ONE conformance contract over every local playback
// driver shape: the injected fake runner (all platforms), the Windows
// powershell.exe driver (real spawn; skipped off-platform), and the macOS
// afplay driver (real spawn; skipped off-platform). Identical contract:
//   play    -> resolves on exit 0
//   cancel  -> stop() ends playback within 200 ms
//   failure -> surfaces as LocalPlaybackDriverError with an error class
//   hygiene -> zero audio bytes in any diagnostic / health payload
// The file lives under tests/ (not src/lib/voice-runtime) because the frozen
// Phase 14 closeout scans every .ts under src/lib/voice-runtime for
// writeFile/spawn authority; a test fixture writer must not trip that scan.

import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  LOCAL_PLAYBACK_DARWIN_COMMAND,
  LOCAL_PLAYBACK_DEFAULT_COMMAND,
  LocalPlaybackDriverError,
  buildDarwinPlaybackArgs,
  buildLocalPlaybackArgs,
  buildWindowsPlaybackArgs,
  createLocalPlaybackDriver,
  createNodePlaybackCommandRunner,
  defaultLocalPlaybackCommand,
  resolveLocalPlaybackPlatform,
  type LocalPlaybackCommandRunner,
  type PlaybackDriver,
} from "../../../src/lib/voice-runtime";

const AUDIO_LEAK = /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/i;
const CANCEL_BUDGET_MS = 200;

// A silent 16-bit mono PCM WAV (8 kHz), `seconds` long. Header only + zeros:
// enough for afplay / SoundPlayer to accept it; nothing audible.
function silentWav(seconds: number): Buffer {
  const sampleRate = 8000;
  const dataBytes = sampleRate * 2 * seconds;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);
  return Buffer.concat([header, Buffer.alloc(dataBytes)]);
}

let fixtureRoot = "";
let longWav = "";
let missingWav = "";
// Device gate for the REAL-spawn variants: a session whose process context
// cannot start an audio queue (observed on the primary Mac when driven
// remotely: `AudioQueueStart failed (-66681)`) cannot prove play/cancel.
// The failure/hygiene/ref cases still run against the real binary; only the
// play-to-completion and cancel cases are skipped, with this named reason.
const deviceBlock = new Map<string, string>();
const DEVICE_BLOCK_SIGNATURE = /AudioQueueStart failed|no default output/i;

beforeAll(() => {
  fixtureRoot = realpathSync.native(
    mkdtempSync(join(tmpdir(), "jarvis-playback-conformance-")),
  );
  longWav = join(fixtureRoot, "silent-3s.wav");
  missingWav = join(fixtureRoot, "does-not-exist.wav");
  writeFileSync(longWav, silentWav(3));
});

async function probeAudioDevice(variant: Variant): Promise<void> {
  if (!variant.enabled || !variant.realSpawn) return;
  const driver = variant.make();
  await driver.loadAudioRef(longWav);
  try {
    await driver.playLoaded();
  } catch (error) {
    const preview =
      (error as LocalPlaybackDriverError).diagnostics?.stderr_preview ?? "";
    if (DEVICE_BLOCK_SIGNATURE.test(preview)) {
      deviceBlock.set(
        variant.name,
        `PENDING-HARDWARE: no startable audio output device in this process context (${preview.trim().slice(0, 60)})`,
      );
    }
  }
}

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function fakeRunner(
  behaviour: "ok" | "fail" | "hang",
): LocalPlaybackCommandRunner & { stopCount: number } {
  let release: (() => void) | null = null;
  const runner = {
    stopCount: 0,
    run: vi.fn(async (command, args, options) => {
      if (behaviour === "hang") {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      const failed = behaviour !== "ok";
      return {
        ...(failed ? { error_class: "driver_error" as const } : {}),
        exit_code: behaviour === "hang" ? null : failed ? 1 : 0,
        signal: behaviour === "hang" ? "SIGTERM" : null,
        ...(failed ? { stderr_preview: "bounded failure" } : {}),
        command_metadata: {
          command,
          arg_count: args.length,
          shell: options.shell,
          timeout_ms: options.timeout_ms,
          metadata_only: true as const,
        },
        metadata_only: true as const,
      };
    }),
    stop: vi.fn(async () => {
      runner.stopCount += 1;
      release?.();
      release = null;
    }),
  };
  return runner;
}

interface Variant {
  readonly name: string;
  readonly enabled: boolean;
  readonly realSpawn: boolean;
  readonly skipReason: string;
  readonly wav: () => string;
  readonly missing: () => string;
  readonly make: (
    overrides?: Partial<{
      readonly signal: AbortSignal;
      readonly failing: boolean;
      readonly hanging: boolean;
    }>,
  ) => PlaybackDriver;
  readonly expectedCommand: string;
  readonly expectedArgCount: number;
}

const VARIANTS: readonly Variant[] = [
  {
    name: "fake runner (injected; every platform)",
    enabled: true,
    realSpawn: false,
    skipReason: "",
    wav: () => longWav,
    missing: () => missingWav,
    make: (o = {}) =>
      createLocalPlaybackDriver({
        runner: fakeRunner(o.hanging ? "hang" : o.failing ? "fail" : "ok"),
        platform: "win32",
        signal: o.signal,
      }),
    expectedCommand: LOCAL_PLAYBACK_DEFAULT_COMMAND,
    expectedArgCount: 6,
  },
  {
    name: "Windows powershell.exe driver (real spawn)",
    enabled: process.platform === "win32",
    realSpawn: true,
    skipReason:
      "skipped off-platform: needs powershell.exe + System.Media.SoundPlayer",
    wav: () => longWav,
    missing: () => missingWav,
    make: (o = {}) =>
      createLocalPlaybackDriver({
        platform: "win32",
        runner: createNodePlaybackCommandRunner(),
        signal: o.signal,
      }),
    expectedCommand: LOCAL_PLAYBACK_DEFAULT_COMMAND,
    expectedArgCount: 6,
  },
  {
    name: "macOS afplay driver (real spawn)",
    enabled: process.platform === "darwin",
    realSpawn: true,
    skipReason: "skipped off-platform: needs /usr/bin/afplay",
    wav: () => longWav,
    missing: () => missingWav,
    make: (o = {}) =>
      createLocalPlaybackDriver({
        platform: "darwin",
        runner: createNodePlaybackCommandRunner(),
        signal: o.signal,
      }),
    expectedCommand: LOCAL_PLAYBACK_DARWIN_COMMAND,
    expectedArgCount: 1,
  },
];

describe("E-024 local playback driver conformance", () => {
  it("selects the command and argv shape by platform; Windows shape untouched", () => {
    expect(resolveLocalPlaybackPlatform("darwin")).toBe("darwin");
    expect(resolveLocalPlaybackPlatform("win32")).toBe("win32");
    expect(resolveLocalPlaybackPlatform("linux")).toBe("win32");
    expect(defaultLocalPlaybackCommand("darwin")).toBe("afplay");
    expect(defaultLocalPlaybackCommand("win32")).toBe("powershell.exe");
    expect(buildLocalPlaybackArgs("/x/y.wav", "darwin")).toEqual(
      buildDarwinPlaybackArgs("/x/y.wav"),
    );
    expect(buildLocalPlaybackArgs("C:/x/y.wav", "win32")).toEqual(
      buildWindowsPlaybackArgs("C:/x/y.wav"),
    );
    expect(buildDarwinPlaybackArgs("/x/y.wav")).toEqual(["/x/y.wav"]);
    expect(buildWindowsPlaybackArgs("C:/x/y.wav")).toHaveLength(6);
  });

  for (const variant of VARIANTS) {
    const run = variant.enabled ? describe : describe.skip;
    const title = variant.enabled
      ? variant.name
      : `${variant.name} — ${variant.skipReason}`;

    run(title, () => {
      beforeAll(() => probeAudioDevice(variant));

      it("plays a loaded local WAV to completion", async ({ skip }) => {
        const blocked = deviceBlock.get(variant.name);
        if (blocked) skip(blocked);
        const driver = variant.make();
        await driver.loadAudioRef(variant.wav());
        await expect(driver.playLoaded()).resolves.toBeUndefined();
        await expect(driver.health()).resolves.toEqual({
          ok: true,
          degraded: false,
          metadata_only: true,
        });
      });

      it(`cancels active playback within ${CANCEL_BUDGET_MS} ms via stop()`, async ({
        skip,
      }) => {
        const blocked = deviceBlock.get(variant.name);
        if (blocked) skip(blocked);
        const driver = variant.make({ hanging: true });
        await driver.loadAudioRef(variant.wav());
        const playing = driver.playLoaded();
        // Let the child spawn / the fake settle into "playing".
        await new Promise((resolve) => setTimeout(resolve, 150));
        const stoppedAt = Date.now();
        await driver.stop();
        const outcome = await playing.then(
          () => "resolved",
          (error: unknown) => error,
        );
        const elapsed = Date.now() - stoppedAt;
        expect(elapsed).toBeLessThanOrEqual(CANCEL_BUDGET_MS);
        // A killed player exits non-zero (signal) -> surfaces as playback_failed;
        // the fake runner mirrors that. Either way the promise has settled.
        if (outcome !== "resolved") {
          expect(outcome).toBeInstanceOf(LocalPlaybackDriverError);
          expect((outcome as LocalPlaybackDriverError).reason).toBe(
            "playback_failed",
          );
        }
      });

      it("cancels through an AbortSignal (abort -> SIGTERM)", async ({
        skip,
      }) => {
        const blocked = deviceBlock.get(variant.name);
        if (blocked) skip(blocked);
        const controller = new AbortController();
        const driver = variant.make({
          hanging: true,
          signal: controller.signal,
        });
        await driver.loadAudioRef(variant.wav());
        const playing = driver.playLoaded();
        await new Promise((resolve) => setTimeout(resolve, 150));
        const abortedAt = Date.now();
        controller.abort();
        await playing.catch(() => undefined);
        expect(Date.now() - abortedAt).toBeLessThanOrEqual(CANCEL_BUDGET_MS);
      });

      it("surfaces failure as a LocalPlaybackDriverError with an error class", async () => {
        const driver = variant.make({ failing: true });
        await driver.loadAudioRef(variant.missing());
        await expect(driver.playLoaded()).rejects.toMatchObject({
          name: "LocalPlaybackDriverError",
          reason: "playback_failed",
          diagnostics: {
            error_class: "driver_error",
            command_metadata: {
              command: variant.expectedCommand,
              arg_count: variant.expectedArgCount,
              shell: false,
              metadata_only: true,
            },
            metadata_only: true,
          },
          metadata_only: true,
        });
        await expect(driver.health()).resolves.toMatchObject({
          ok: false,
          degraded: true,
          error_class: "driver_error",
          metadata_only: true,
        });
      });

      it("rejects non-local / non-WAV refs before any command runs", async () => {
        const driver = variant.make();
        await expect(
          driver.loadAudioRef("https://example.com/audio.wav"),
        ).rejects.toMatchObject({ reason: "invalid_audio_ref" });
        await expect(driver.loadAudioRef("relative.wav")).rejects.toMatchObject(
          { reason: "invalid_audio_ref" },
        );
        await expect(driver.playLoaded()).rejects.toMatchObject({
          reason: "not_loaded",
        });
      });

      it("emits zero audio bytes in any diagnostic or health payload", async () => {
        const driver = variant.make({ failing: true });
        await driver.loadAudioRef(variant.missing());
        let diagnostics = "";
        try {
          await driver.playLoaded();
        } catch (error) {
          diagnostics = JSON.stringify(
            (error as LocalPlaybackDriverError).diagnostics,
          );
        }
        expect(diagnostics).not.toMatch(AUDIO_LEAK);
        expect(diagnostics.length).toBeLessThanOrEqual(1024);
        expect(JSON.stringify(await driver.health())).not.toMatch(AUDIO_LEAK);
      });
    });
  }
});
