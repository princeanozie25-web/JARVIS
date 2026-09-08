// Presence · the standing brief. What JARVIS has to tell you right now, as
// plain sentences it posts into a fresh thread: what needs you, what it did
// today, what is still open, and whether its brain, voice or memory are
// down. Built from real state (approvals, sessions, the Self Model), never
// from a greeting template with nothing behind it. Local same-origin only.
import { NextResponse } from "next/server";

import { listPendingForOperator } from "@/lib/approvals/operator-decisions";
import { getDb } from "@/lib/db";
import { listMessages } from "@/lib/db/messages";
import { listSessions } from "@/lib/db/sessions";
import { isLocalPresenceRequest } from "@/lib/presence/local-request";
import { createDefaultSelfModel } from "@/lib/self-model/default";
import { tools } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up.";
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

function plainRuntimeTrouble(subject: string, status: string): string | null {
  const offline = status === "offline";
  if (subject === "provider:ollama")
    return offline
      ? "My brain is offline, so I can't think until Ollama is back."
      : "My brain is slow to answer right now.";
  if (subject === "voice:tts-server")
    return offline
      ? "My voice is off; I'll answer in text."
      : "My voice is patchy right now.";
  if (subject === "runtime.db")
    return offline
      ? "I can't reach my memory."
      : "My memory is slow right now.";
  return null;
}

export async function GET(req: Request): Promise<Response> {
  if (!isLocalPresenceRequest(req))
    return new Response("Local only", { status: 403 });
  const db = getDb();
  const now = Date.now();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const lines: string[] = [];

  // What needs you.
  const pending = listPendingForOperator(db, now).filter(
    (p) => p.operator_token_available,
  );
  lines.push(
    pending.length === 0
      ? "Nothing needs you."
      : pending.length === 1
        ? "One thing needs you; it's just below."
        : `${pending.length} things need you; they're just below.`,
  );

  // What happened today, and what is still open.
  const today: string[] = [];
  const open: string[] = [];
  for (const s of listSessions(db, 30)) {
    if (s.updated_at < startOfDay.getTime()) break;
    const messages = listMessages(db, s.id).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    if (messages.length === 0) continue;
    const first = messages.find((m) => m.role === "user");
    const last = messages[messages.length - 1]!;
    const title = clip(first?.content ?? "a thread", 48);
    if (last.role === "assistant")
      today.push(`**${title}** — ${clip(last.content, 84)}`);
    else open.push(title);
  }
  if (today.length > 0) {
    lines.push(
      `${today.length === 1 ? "One thing" : `${Math.min(today.length, 5)} things`} today:`,
      today
        .slice(0, 5)
        .map((t) => `- ${t}`)
        .join("\n"),
    );
  }
  if (open.length > 0) {
    lines.push(
      `Still waiting on me: ${open
        .slice(0, 3)
        .map((t) => `“${t}”`)
        .join(", ")}.`,
    );
  }

  // Whether I am all here.
  try {
    const model = createDefaultSelfModel({
      db,
      tools: tools.list(),
      persistSnapshots: false,
      probeTimeoutMs: 600,
    });
    const claims = await model.claims({ category: "runtime" });
    for (const c of claims) {
      if (c.status !== "offline" && c.status !== "degraded") continue;
      const line = plainRuntimeTrouble(c.subject, c.status);
      if (line && !lines.includes(line)) lines.push(line);
    }
  } catch {
    /* if I cannot check on myself, I say nothing about it */
  }

  return NextResponse.json(
    {
      ok: true,
      generated_at: new Date(now).toISOString(),
      greeting: greetingFor(new Date(now).getHours()),
      // Paragraphs; the one list stays a list.
      text: lines.join("\n\n"),
      needs_you: pending.length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
