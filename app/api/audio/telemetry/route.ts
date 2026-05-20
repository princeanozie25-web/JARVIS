import { NextResponse } from "next/server";
import { z } from "zod";
import { recordEvent } from "@/lib/telemetry";

const AudioTelemetrySchema = z.object({
  eventType: z.enum([
    "mic_permission_granted",
    "mic_permission_denied",
    "ptt_started",
    "ptt_stopped",
  ]),
  status: z.enum([
    "idle",
    "requesting_permission",
    "ready",
    "recording",
    "error",
  ]),
  selectedInputDeviceId: z.string().optional(),
  selectedOutputDeviceId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = AudioTelemetrySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid audio telemetry event." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  recordEvent({
    event_type: input.eventType,
    success:
      input.eventType !== "mic_permission_denied" && input.status !== "error",
    notes: [
      `audio_status=${input.status}`,
      input.selectedInputDeviceId
        ? `selected_input_device=${input.selectedInputDeviceId}`
        : "selected_input_device=default",
      input.selectedOutputDeviceId
        ? `selected_output_device=${input.selectedOutputDeviceId}`
        : "selected_output_device=default",
      input.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return NextResponse.json({ ok: true });
}
