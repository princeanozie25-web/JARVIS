// Presence · desk — the threads JARVIS has been working in, in plain words.
// Local same-origin only. Reads sessions + messages + what needs you; no
// governance vocabulary crosses this boundary.
import { NextResponse } from "next/server";

import { listPendingForOperator } from "@/lib/approvals/operator-decisions";
import { getDb } from "@/lib/db";
import { listMessages } from "@/lib/db/messages";
import { listSessions } from "@/lib/db/sessions";
import { isLocalPresenceRequest } from "@/lib/presence/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DeskThread {
  id: string;
  title: string;
  status_line: string;
  updated_at: number;
  turns: number;
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export async function GET(req: Request): Promise<Response> {
  if (!isLocalPresenceRequest(req))
    return new Response("Local only", { status: 403 });
  const db = getDb();
  const now = Date.now();
  const threads: DeskThread[] = [];
  for (const s of listSessions(db, 24)) {
    const messages = listMessages(db, s.id).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    if (messages.length === 0) continue;
    const firstUser = messages.find((m) => m.role === "user");
    const last = messages[messages.length - 1]!;
    threads.push({
      id: s.id,
      title: clip(firstUser?.content ?? "Untitled", 72),
      status_line:
        last.role === "assistant"
          ? clip(last.content, 110)
          : "Waiting on JARVIS",
      updated_at: s.updated_at,
      turns: messages.length,
    });
  }
  const pending = listPendingForOperator(db, now);
  return NextResponse.json({
    ok: true,
    generated_at: new Date(now).toISOString(),
    threads,
    needs_you: pending.length,
  });
}
