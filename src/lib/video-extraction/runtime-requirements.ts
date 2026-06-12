// Phase 23C source of truth for vision-lane tool minimums. The runbook
// (docs/runbooks/phase23-runtime-setup.md) cites these constants; change them
// only with a registry entry.
export const MIN_YTDLP_VERSION = "2026.03.17" as const;
export const MIN_FFMPEG_VERSION = "8.1.1" as const;

export const VIDEO_RUNTIME_TOOLS = ["yt-dlp", "ffmpeg", "ffprobe"] as const;

export type VideoRuntimeTool = (typeof VIDEO_RUNTIME_TOOLS)[number];

export function minimumVersionForTool(tool: VideoRuntimeTool): string {
  return tool === "yt-dlp" ? MIN_YTDLP_VERSION : MIN_FFMPEG_VERSION;
}

// Pulls the first dotted-numeric token out of a raw --version line, e.g.
// "ffmpeg version 8.1.1-essentials_build-www.gyan.dev ..." -> "8.1.1".
export function extractDottedVersion(raw: string): string | null {
  const match = raw.match(/\d+(?:\.\d+)+/);
  return match ? match[0] : null;
}

export function meetsMinimumVersion(
  rawVersion: string | null,
  minimum: string,
): boolean {
  if (!rawVersion) {
    return false;
  }
  const actual = extractDottedVersion(rawVersion);
  if (!actual) {
    return false;
  }
  const actualParts = actual.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);
  const length = Math.max(actualParts.length, minimumParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = actualParts[index] ?? 0;
    const right = minimumParts[index] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return true;
}
