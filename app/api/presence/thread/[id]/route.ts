// Presence · one thread's conversation, so the sidebar can reopen it and the
// same conversation continues. Local same-origin only; user and assistant
// turns only (system prompts never reach the screen).
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { listMessages } from "@/lib/db/messages";
import { isLocalPresenceRequest } from "@/lib/presence/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isLocalPresenceRequest(req))
    return new Response("Local only", { status: 403 });
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return new Response("Not found", { status: 404 });
  const messages = listMessages(getDb(), id)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role === "user" ? ("you" as const) : ("jarvis" as const),
      text: m.content,
      at: m.created_at,
    }));
  return NextResponse.json({ ok: true, id, messages });
}
