import { statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildNarrationLines,
  createPiperNarrationFallbackProvider,
  DEMO_SCRIPT_RECRUITER,
  loadPiperFallbackConfig,
  prepareDemoNarration,
  selectNarrationProvider,
  type DemoNarrationProvider,
} from "@/lib/demo-director";
import { createRuntimeNarrationProviders } from "@/lib/demo-director/chatterbox";
import type {
  PiperProcessRunner,
  PiperSpawnedProcess,
} from "@/lib/voice-runtime";

// Minimal valid RIFF/WAVE container so the faked Piper spawn writes a real,
// non-empty WAV that runner.stat() can size.
function wavBytes(): Buffer {
  const dataLen = 8;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(22050, 24);
  buf.writeUInt32LE(44100, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

// Fakes the Piper subprocess: on stdin.end it writes a WAV to --output_file and
// then closes with code 0. Proves the chain reaches real synthesis without
// executing the actual piper.exe.
function fakeWritingRunner(): Partial<PiperProcessRunner> {
  return {
    spawn: (_executablePath, args) => {
      const flagIndex = args.indexOf("--output_file");
      const outputPath = args[flagIndex + 1] as string;
      const closeListeners: Array<
        (code: number | null, signal: string | null) => void
      > = [];
      const proc = {
        stdin: {
          write: () => true,
          end: () => {
            writeFileSync(outputPath, wavBytes());
            void Promise.resolve().then(() => {
              for (const listener of closeListeners) listener(0, null);
            });
          },
        },
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event: string, listener: (...args: unknown[]) => void) => {
          if (event === "close") {
            closeListeners.push(
              listener as (code: number | null, signal: string | null) => void,
            );
          }
        },
        kill: () => true,
      };
      return proc as unknown as PiperSpawnedProcess;
    },
    mkdir: async () => {},
    stat: async (path: string) => ({ size: statSync(path).size }),
    now_ms: () => 1,
  };
}

function unreachableUpstream(
  provider_id: "chatterbox-tts-server" | "kokoro",
  priority: number,
): DemoNarrationProvider {
  return {
    provider_id,
    priority,
    health: async () => ({
      provider_id,
      ok: false,
      degraded: true,
      checked_at_ms: 1,
      metadata_only: true,
    }),
  };
}

function envFor(outputDir: string): Record<string, string | undefined> {
  return {
    JARVIS_PIPER_EXECUTABLE: join(outputDir, "piper.exe"),
    JARVIS_PIPER_MODEL: join(outputDir, "model.onnx"),
    JARVIS_PIPER_MODEL_CONFIG: join(outputDir, "model.onnx.json"),
    JARVIS_TTS_OUTPUT_DIR: outputDir,
    JARVIS_TTS_VOICE_ID: "en_US-lessac-medium",
  };
}

let tmp: string;
let bogusConfigPath: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "jarvis-piper-fallback-"));
  bogusConfigPath = join(tmp, "no-such-config.yaml");
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("Phase 23G-2 Piper terminal fallback (I-23G2-1)", () => {
  it("falls to the Piper terminal and produces non-empty WAV cues when Chatterbox + Kokoro are down", async () => {
    const terminal = createPiperNarrationFallbackProvider({
      configPath: bogusConfigPath,
      env: envFor(tmp),
      outputDir: tmp,
      existsImpl: () => true,
      runner: fakeWritingRunner(),
      now: () => 1,
    });

    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        unreachableUpstream("chatterbox-tts-server", 0),
        unreachableUpstream("kokoro", 1),
        terminal,
      ],
    });

    expect(track.provider_id).toBe("existing-local-fallback");
    expect(track.audio_cues.length).toBe(track.lines.length);
    expect(track.audio_cues.length).toBeGreaterThan(0);
    expect(track.audio_cues.every((cue) => cue.byte_length > 0)).toBe(true);
    expect(track.audio_cues.every((cue) => cue.mime_type === "audio/wav")).toBe(
      true,
    );
    expect(
      track.audio_cues.every(
        (cue) => cue.no_auto_play && cue.no_voice_authority,
      ),
    ).toBe(true);
    expect(
      track.audio_cues.every(
        (cue) => cue.provider_id === "existing-local-fallback",
      ),
    ).toBe(true);
  });

  it("maps a synthesized line to a metadata-only demo audio cue", async () => {
    const terminal = createPiperNarrationFallbackProvider({
      configPath: bogusConfigPath,
      env: envFor(tmp),
      outputDir: tmp,
      existsImpl: () => true,
      runner: fakeWritingRunner(),
      now: () => 1,
    });
    const line = buildNarrationLines(DEMO_SCRIPT_RECRUITER)[0]!;

    const cue = await terminal.synthesize!(line);

    expect(cue.line_id).toBe(line.line_id);
    expect(cue.provider_id).toBe("existing-local-fallback");
    expect(cue.byte_length).toBeGreaterThan(0);
    expect(cue.local_ref.startsWith(tmp)).toBe(true);
    expect(cue.metadata_only).toBe(true);
  });
});

describe("Phase 23G-2 fail-closed health (I-23G2-2)", () => {
  it("reports unavailable when the Piper executable is missing", async () => {
    const terminal = createPiperNarrationFallbackProvider({
      configPath: bogusConfigPath,
      env: envFor(tmp),
      existsImpl: (path) => !path.endsWith("piper.exe"),
      now: () => 1,
    });

    await expect(terminal.health()).resolves.toMatchObject({
      provider_id: "existing-local-fallback",
      ok: false,
      degraded: true,
    });
  });

  it("reports unavailable when no config can be resolved at all", async () => {
    const terminal = createPiperNarrationFallbackProvider({
      configPath: bogusConfigPath,
      env: {},
      existsImpl: () => true,
      now: () => 1,
    });

    await expect(terminal.health()).resolves.toMatchObject({
      ok: false,
      degraded: true,
    });
  });

  it("reports ok when executable, model, and config all exist", async () => {
    const terminal = createPiperNarrationFallbackProvider({
      configPath: bogusConfigPath,
      env: envFor(tmp),
      existsImpl: () => true,
      now: () => 1,
    });

    await expect(terminal.health()).resolves.toMatchObject({
      ok: true,
      degraded: false,
    });
  });
});

describe("Phase 23G-2 chain order + upstream unchanged (I-23G2-3)", () => {
  it("preserves chain order chatterbox -> kokoro -> existing-local-fallback", () => {
    expect(
      createRuntimeNarrationProviders().map((provider) => provider.provider_id),
    ).toEqual(["chatterbox-tts-server", "kokoro", "existing-local-fallback"]);
  });

  it("still selects Chatterbox when it is healthy (run-1 path unchanged)", async () => {
    const fetchMock = async () => new Response("{}", { status: 200 });
    const providers = createRuntimeNarrationProviders({
      fetch_impl: fetchMock as typeof fetch,
      now: () => 1,
    });

    const selected = await selectNarrationProvider(providers);
    expect(selected.provider.provider_id).toBe("chatterbox-tts-server");
  });
});

describe("Phase 23G-2 fallback config resolution", () => {
  it("loads the committed documented defaults from config/voice/piper-fallback.yaml", () => {
    const result = loadPiperFallbackConfig(undefined, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.voiceId).toBe("en_US-lessac-medium");
      expect(result.config.executable).toContain("piper.exe");
      expect(result.config.model).toContain("en_US-lessac-medium.onnx");
    }
  });

  it("lets environment variables override file values per field", () => {
    const result = loadPiperFallbackConfig(undefined, {
      JARVIS_PIPER_EXECUTABLE: "/custom/piper",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.executable).toBe("/custom/piper");
      expect(result.config.voiceId).toBe("en_US-lessac-medium");
    }
  });

  it("fails closed when neither file nor env supplies the paths", () => {
    const result = loadPiperFallbackConfig(bogusConfigPath, {});
    expect(result).toEqual({
      ok: false,
      reason: "missing_or_unreadable_file",
    });
  });
});
