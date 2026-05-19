import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getKeeper, listKeepers } from "@/lib/keepers";

function blockedResponse(result: { reason: string; featureId: string }) {
  return NextResponse.json(
    {
      ok: false,
      status: "blocked",
      featureId: result.featureId,
      reason: result.reason,
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const accessContext = {
    caller: "api.keepers",
    feature_id: "keeper_interface" as const,
    purpose: id ? "get_keeper_metadata" : "list_keeper_metadata",
    personal_context: true,
  };
  const result = id
    ? getKeeper(getDb(), id, { accessContext })
    : listKeepers(getDb(), { accessContext });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json(
    id
      ? {
          keeper: result.value,
        }
      : {
          keepers: result.value,
        },
  );
}
