import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CHATTERBOX_URL,
  DEFAULT_KOKORO_URL,
  createChatterboxNarrationProvider,
  createKokoroNarrationProvider,
  createRuntimeNarrationProviders,
} from "@/lib/demo-director/chatterbox";
import { buildNarrationLines, DEMO_SCRIPT_GENERAL } from "@/lib/demo-director";

let tmpRoot: string | null = null;

afterEach(async () => {
  if (tmpRoot) {
    await rm(tmpRoot, { recursive: true, force: true });
    tmpRoot = null;
  }
});

async function tempRoot() {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "jarvis-chatterbox-"));
  return tmpRoot;
}

describe("Chatterbox narration runtime", () => {
  it("checks Chatterbox health against the local status endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const provider = createChatterboxNarrationProvider({
      fetch_impl: fetchMock,
      now: () => 10,
    });

    await expect(provider.health()).resolves.toEqual({
      provider_id: "chatterbox-tts-server",
      ok: true,
      degraded: false,
      checked_at_ms: 10,
      metadata_only: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_CHATTERBOX_URL}/api/ui/initial-data`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("checks Kokoro health as the second provider in the chain", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 503 }));
    const provider = createKokoroNarrationProvider({
      fetch_impl: fetchMock,
      now: () => 20,
    });

    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "kokoro",
      ok: false,
      degraded: true,
      checked_at_ms: 20,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_KOKORO_URL}/health`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("writes synthesized Chatterbox audio to local disk only", async () => {
    const outputDir = await tempRoot();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/wav" },
      }),
    );
    const provider = createChatterboxNarrationProvider({
      output_dir: outputDir,
      fetch_impl: fetchMock,
    });
    const line = buildNarrationLines(DEMO_SCRIPT_GENERAL)[0]!;

    const audio = await provider.synthesize!(line);

    expect(audio.provider_id).toBe("chatterbox-tts-server");
    expect(audio.no_auto_play).toBe(true);
    expect(audio.no_voice_authority).toBe(true);
    await expect(readFile(audio.local_ref)).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_CHATTERBOX_URL}/tts`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("exposes the runtime chain in Chatterbox, Kokoro, local fallback order", () => {
    expect(
      createRuntimeNarrationProviders().map((provider) => provider.provider_id),
    ).toEqual(["chatterbox-tts-server", "kokoro", "existing-local-fallback"]);
  });
});
