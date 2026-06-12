import { sanitizeVisionMetadataPayload } from "@/lib/vision-runtime";

// Shared 23D event conventions. Events use vision-allowlisted field names
// only; counts and temporal sizes are BANDED here while exact numbers live in
// the on-disk artifact files. event_id may carry composed hashes but remains
// OPAQUE — nothing may parse meaning from it.

export const VIDEO_COUNT_BANDS = [
  "empty",
  "1_to_30",
  "31_to_120",
  "over_120",
] as const;
export type VideoCountBand = (typeof VIDEO_COUNT_BANDS)[number];

export const VIDEO_DURATION_BANDS = [
  "under_10s",
  "10s_to_60s",
  "60s_to_600s",
  "over_600s",
] as const;
export type VideoDurationBand = (typeof VIDEO_DURATION_BANDS)[number];

export function videoCountBand(count: number): VideoCountBand {
  if (count <= 0) return "empty";
  if (count <= 30) return "1_to_30";
  if (count <= 120) return "31_to_120";
  return "over_120";
}

export function videoDurationBand(durationSeconds: number): VideoDurationBand {
  if (durationSeconds < 10) return "under_10s";
  if (durationSeconds < 60) return "10s_to_60s";
  if (durationSeconds < 600) return "60s_to_600s";
  return "over_600s";
}

// Defense in depth shared by every 23D stage: events pass the vision
// metadata gate before leaving the module; construction keeps this
// always-true.
export async function gateAndEmit<T extends Record<string, unknown>>(
  event: T,
  emit: ((event: T) => void | Promise<void>) | undefined,
  sink: T[],
): Promise<void> {
  const gate = sanitizeVisionMetadataPayload({ ...event });
  if (!gate.ok) {
    throw new Error(
      `video-extraction produced a non-metadata-safe event: ${gate.reason}`,
    );
  }
  sink.push(event);
  await emit?.(event);
}
