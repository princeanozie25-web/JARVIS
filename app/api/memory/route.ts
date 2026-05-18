import { NextResponse } from "next/server";
import { getDb, listLongTermMemory } from "@/lib/db";
import { vaultRootFromEnv } from "@/lib/memory/vault";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 200)
      : 100;

  return NextResponse.json({
    vaultRoot: vaultRootFromEnv(),
    memories: listLongTermMemory(getDb(), limit),
  });
}
