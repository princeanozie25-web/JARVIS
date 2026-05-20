import type {
  LocalSpeechProviderConfig,
  SpeechProviderMetadata,
  SpeechProviderStatus,
} from "./types";

export interface LocalTtsRuntimeConfig extends LocalSpeechProviderConfig {
  enabled: boolean;
}

export interface LocalTtsRuntimeStatus {
  providerId: "local-tts-placeholder";
  status: SpeechProviderStatus;
  message?: string;
  metadata: SpeechProviderMetadata;
  config: LocalTtsRuntimeConfig;
}

export interface LocalTtsRuntimeHandle {
  shutdown(): Promise<void>;
}

export interface LocalTtsRuntimeOptions {
  config: LocalTtsRuntimeConfig;
  metadata?: SpeechProviderMetadata;
  fileExists?: (path: string) => Promise<boolean>;
  launchRuntime?: (
    config: LocalTtsRuntimeConfig,
    signal: AbortSignal,
  ) => Promise<LocalTtsRuntimeHandle>;
}

export const localTtsRuntimeMetadata: SpeechProviderMetadata = {
  runsLocally: true,
  requiresNetwork: false,
  storesAudio: false,
  supportsStreaming: false,
};

export class LocalTtsRuntime {
  private status: SpeechProviderStatus = "disabled";
  private message: string | undefined;
  private handle: LocalTtsRuntimeHandle | undefined;

  constructor(private readonly opts: LocalTtsRuntimeOptions) {
    this.status = opts.config.enabled ? "not_installed" : "disabled";
  }

  async initialize(): Promise<LocalTtsRuntimeStatus> {
    await this.shutdown();

    const config = this.opts.config;
    if (!config.enabled) {
      this.status = "disabled";
      this.message = "Local TTS provider is disabled.";
      return this.getStatus();
    }

    this.status = "loading";
    this.message = undefined;

    try {
      assertLocalSpeechOnly(this.metadata);
      const availability = await this.checkAvailability(config);
      if (!availability.ok) {
        this.status = "not_installed";
        this.message = availability.message;
        return this.getStatus();
      }

      if (!this.opts.launchRuntime) {
        this.status = "error";
        this.message = "Local TTS runtime launcher is not configured.";
        return this.getStatus();
      }

      this.handle = await launchRuntimeWithTimeoutCleanup(
        this.opts.launchRuntime,
        config,
      );
      this.status = "ready";
      this.message = "Local TTS runtime is ready.";
      return this.getStatus();
    } catch (error) {
      await this.shutdown();
      this.status = "error";
      this.message = error instanceof Error ? error.message : String(error);
      return this.getStatus();
    }
  }

  async shutdown(): Promise<void> {
    const handle = this.handle;
    this.handle = undefined;
    if (handle) {
      await handle.shutdown();
    }
  }

  getStatus(): LocalTtsRuntimeStatus {
    return {
      providerId: "local-tts-placeholder",
      status: this.status,
      message: this.message,
      metadata: this.metadata,
      config: this.opts.config,
    };
  }

  private get metadata(): SpeechProviderMetadata {
    return this.opts.metadata ?? localTtsRuntimeMetadata;
  }

  private async checkAvailability(
    config: LocalTtsRuntimeConfig,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!config.binaryPath) {
      return { ok: false, message: "Local TTS binary path is not set." };
    }
    if (!config.voiceModelPath) {
      return { ok: false, message: "Local TTS voice model path is not set." };
    }

    const exists = this.opts.fileExists ?? defaultFileExists;
    const [binaryExists, modelExists] = await Promise.all([
      exists(config.binaryPath),
      exists(config.voiceModelPath),
    ]);

    if (!binaryExists) {
      return {
        ok: false,
        message: `Local TTS binary was not found: ${config.binaryPath}`,
      };
    }
    if (!modelExists) {
      return {
        ok: false,
        message: `Local TTS voice model was not found: ${config.voiceModelPath}`,
      };
    }

    return { ok: true };
  }
}

export function assertLocalSpeechOnly(metadata: SpeechProviderMetadata): void {
  if (!metadata.runsLocally) {
    throw new Error("Local TTS runtime must run locally.");
  }
  if (metadata.requiresNetwork) {
    throw new Error("Local TTS runtime must not require network access.");
  }
  if (metadata.storesAudio) {
    throw new Error("Local TTS runtime must not store audio.");
  }
}

async function defaultFileExists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void | Promise<void>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          Promise.resolve(onTimeout?.()).catch(() => undefined);
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function launchRuntimeWithTimeoutCleanup(
  launchRuntime: (
    config: LocalTtsRuntimeConfig,
    signal: AbortSignal,
  ) => Promise<LocalTtsRuntimeHandle>,
  config: LocalTtsRuntimeConfig,
): Promise<LocalTtsRuntimeHandle> {
  const startupAbort = new AbortController();
  let abandoned = false;
  const launched = launchRuntime(config, startupAbort.signal);

  launched
    .then(async (handle) => {
      if (abandoned) {
        try {
          await handle.shutdown();
        } catch {
          // Late handles are already abandoned. Cleanup is best-effort so a
          // shutdown failure cannot create a second unhandled failure path.
        }
      }
    })
    .catch(() => {
      // initialize() reports startup failure; this sidecar only prevents late
      // handles from outliving a timed-out startup attempt.
    });

  try {
    return await withTimeout(
      launched,
      config.startupTimeoutMs,
      "Local TTS startup timed out.",
      () => {
        abandoned = true;
        startupAbort.abort();
      },
    );
  } catch (error) {
    abandoned = true;
    throw error;
  }
}
