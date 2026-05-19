import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listRuntimeCommands } from "@/lib/runtime-commands";

export async function GET() {
  return NextResponse.json({
    commands: listRuntimeCommands({ db: getDb() }),
  });
}
