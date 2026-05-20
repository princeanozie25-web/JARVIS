import { describe, expect, it, vi } from "vitest";
import {
  assertLocalSpeechOnly,
  LocalTtsRuntime,
  localTtsRuntimeMetadata,
  type LocalTtsRuntimeConfig,
  type LocalTtsRuntimeHandle,
} from "./local-runtime";
import { localTtsPlaceholderConfig } from "./local-placeholder";

const enabledConfig: LocalTtsRuntimeConfig = {
  ...localTtsPlaceholderConfig,
  enabled: true,
  binaryPath: "C:\\local\\tts.exe",
  voiceModelPath: "C:\\local\\voice.onnx",
  speakerId: "jarvis",
  sampleRate: 24_000,
  startupTimeoutMs: 1,
};

describe("LocalTtsRuntime", () => {
  it("stays disabled by default", async () => {
    const runtime = new LocalTtsRuntime({
      config: {
        ...localTtsPlaceholderConfig,
        enabled: false,
      },
      fileExists: vi.fn(),
      launchRuntime: vi.fn(),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      providerId: "local-tts-placeholder",
      status: "disabled",
      message: "Local TTS provider is disabled.",
      metadata: localTtsRuntimeMetadata,
    });
  });

  it("reports not installed when runtime paths are missing", async () => {
    const runtime = new LocalTtsRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(false),
      launchRuntime: vi.fn(),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "not_installed",
      message: `Local TTS binary was not found: ${enabledConfig.binaryPath}`,
    });
  });

  it("requires a launcher before reporting ready", async () => {
    const runtime = new LocalTtsRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "error",
      message: "Local TTS runtime launcher is not configured.",
    });
  });

  it("times out startup and shuts down a late handle", async () => {
    let startupAborted = false;
    let resolveLateHandle:
      | ((handle: LocalTtsRuntimeHandle) => void)
      | undefined;
    const lateShutdown = vi.fn().mockResolvedValue(undefined);
    const runtime = new LocalTtsRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
      launchRuntime: vi.fn(
        (_config, signal) =>
          new Promise<LocalTtsRuntimeHandle>((resolve) => {
            resolveLateHandle = resolve;
            signal.addEventListener("abort", () => {
              startupAborted = true;
            });
          }),
      ),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "error",
      message: "Local TTS startup timed out.",
    });
    expect(startupAborted).toBe(true);

    resolveLateHandle?.({ shutdown: lateShutdown });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lateShutdown).toHaveBeenCalledTimes(1);
  });

  it("initializes with a launcher and shuts down idempotently", async () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const runtime = new LocalTtsRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
      launchRuntime: vi.fn().mockResolvedValue({ shutdown }),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "ready",
      message: "Local TTS runtime is ready.",
    });

    await runtime.shutdown();
    await runtime.shutdown();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("rejects metadata that would break the local-only invariant", () => {
    expect(() =>
      assertLocalSpeechOnly({
        ...localTtsRuntimeMetadata,
        requiresNetwork: true,
      }),
    ).toThrow("Local TTS runtime must not require network access.");

    expect(() =>
      assertLocalSpeechOnly({
        ...localTtsRuntimeMetadata,
        storesAudio: true,
      }),
    ).toThrow("Local TTS runtime must not store audio.");
  });
});
