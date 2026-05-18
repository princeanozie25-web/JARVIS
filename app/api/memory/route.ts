import { NextResponse } from "next/server";
import { getDb, searchLongTermMemory } from "@/lib/db";
import {
  LONG_TERM_MEMORY_CATEGORIES,
  type LongTermMemoryCategory,
} from "@/lib/memory/types";
import { vaultRootFromEnv } from "@/lib/memory/vault";

function optionalParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  return value ? value : undefined;
}

function categoryParam(value?: string): LongTermMemoryCategory | undefined {
  return LONG_TERM_MEMORY_CATEGORIES.includes(value as LongTermMemoryCategory)
    ? (value as LongTermMemoryCategory)
    : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 25);
  const maxResults =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 20)
      : 25;
  const sensitivityParam = url.searchParams.get("sensitivityCeiling");
  const sensitivityCeiling =
    sensitivityParam === "public" || sensitivityParam === "personal"
      ? sensitivityParam
      : "personal";

  return NextResponse.json({
    vaultRoot: vaultRootFromEnv(),
    memories: searchLongTermMemory(getDb(), {
      query: optionalParam(url, "q"),
      category: categoryParam(optionalParam(url, "category")),
      project: optionalParam(url, "project"),
      tag: optionalParam(url, "tag"),
      maxResults,
      sensitivityCeiling,
    }),
  });
}
