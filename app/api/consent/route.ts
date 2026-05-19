import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  PHASE_3D_FEATURE_IDS,
  readConsentManifest,
  setConsentFromUserAction,
} from "@/lib/consent";

const UpdateConsentRequestSchema = z.object({
  featureId: z.enum(PHASE_3D_FEATURE_IDS),
  enabled: z.boolean(),
  scope: z.string().min(1).max(120).optional(),
});

export async function GET() {
  return NextResponse.json({
    manifest: readConsentManifest({ db: getDb() }),
  });
}

export async function PATCH(req: Request) {
  let payload: unknown = {};
  try {
    const text = await req.text();
    payload = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = UpdateConsentRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const record = setConsentFromUserAction({
    db: getDb(),
    featureId: parsed.data.featureId,
    enabled: parsed.data.enabled,
    scope: parsed.data.scope,
  });

  return NextResponse.json({
    record,
    manifest: readConsentManifest({ db: getDb() }),
  });
}
