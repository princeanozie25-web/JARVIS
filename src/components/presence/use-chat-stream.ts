"use client";
// The conversation, as the page sees it: send a turn, receive JARVIS's words
// and the plain-language asides of what it is doing, over the existing
// /api/chat SSE stream. No governance vocabulary reaches the transcript.
import { useCallback, useRef, useState } from "react";

import { parseSseEvents } from "@/lib/streaming/sse";

export type EntryRole = "you" | "jarvis" | "aside";
export interface TranscriptEntry {
  id: string;
  role: EntryRole;
  text: string;
  at: number;
}
export type PresenceStatus = "quiet" | "listening" | "thinking" | "speaking";

const SESSION_KEY = "jarvis.presence.session";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function loadSession(): string {
  try {
    const v = window.localStorage.getItem(SESSION_KEY);
    if (v) return v;
    const id = newId();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

/** "read_file" → "read a file"; "memory.recall" → "looked something up". */
export function asideFor(
  toolName: string,
  phase: "start" | "done" | "needs",
): string {
  const verbs: Record<string, [string, string]> = {
    "fs.read_file": ["reading a file", "read a file"],
    "fs.list_dir": ["looking through a folder", "looked through a folder"],
    "fs.stat": ["checking a file", "checked a file"],
    "doc.read_pdf": ["reading a document", "read a document"],
    "doc.read_docx": ["reading a document", "read a document"],
    "doc.read_txt": ["reading a note", "read a note"],
    "memory.recall": ["remembering", "remembered"],
    "memory.note": ["making a note", "made a note"],
    "project.list": ["checking your projects", "checked your projects"],
    "project.get": ["opening a project", "opened a project"],
    "project.summarize": ["summarising a project", "summarised a project"],
    "self.describe": ["thinking about what I am", "thought about what I am"],
    "self.status": ["checking on myself", "checked on myself"],
    "self.capabilities": ["checking what I can do", "checked what I can do"],
    "self.explain": ["checking my reasons", "checked my reasons"],
    "self.limits": ["checking what I may not do", "checked what I may not do"],
    "self.context": ["gathering myself", "gathered myself"],
    "fs.create_file": ["creating a file", "created a file"],
    "fs.write_file": ["writing a file", "wrote a file"],
    "fs.append_file": ["adding to a file", "added to a file"],
    "fs.mkdir": ["making a folder", "made a folder"],
    "fs.rename": ["renaming something", "renamed something"],
    "fs.delete_file": ["deleting a file", "deleted a file"],
    "fs.undo": ["undoing that", "undid that"],
    "project.register": ["registering a project", "registered a project"],
    "project.set_status": ["updating a project", "updated a project"],
  };
  const pair = verbs[toolName];
  if (phase === "needs")
    return `needs you before it ${pair ? pair[0].replace(/^(\w+)ing/, "$1s") : `runs ${toolName}`}`;
  if (pair) return phase === "start" ? pair[0] : pair[1];
  return phase === "start" ? `working: ${toolName}` : `done: ${toolName}`;
}

export function useChatStream(
  options: {
    onReply?: (text: string) => void;
    onStatus?: (s: PresenceStatus) => void;
  } = {},
) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const historyRef = useRef<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const abortRef = useRef<AbortController | null>(null);

  const session = () => (sessionRef.current ??= loadSession());

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    options.onStatus?.("quiet");
  }, [options]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      options.onStatus?.("thinking");
      const youId = newId();
      const jarvisId = newId();
      setEntries((e) => [
        ...e,
        { id: youId, role: "you", text: clean, at: Date.now() },
      ]);
      historyRef.current.push({ role: "user", content: clean });
      let reply = "";
      const appendReply = (chunk: string) => {
        reply += chunk;
        setEntries((e) => {
          const i = e.findIndex((x) => x.id === jarvisId);
          if (i === -1)
            return [
              ...e,
              { id: jarvisId, role: "jarvis", text: reply, at: Date.now() },
            ];
          const next = e.slice();
          next[i] = { ...next[i]!, text: reply };
          return next;
        });
      };
      const aside = (text: string) =>
        setEntries((e) => [
          ...e,
          { id: newId(), role: "aside", text, at: Date.now() },
        ]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: session(),
            assistantMessageId: jarvisId,
            messages: historyRef.current.slice(-40),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          aside(
            res.status === 429
              ? "give me a moment"
              : "I could not reach my brain",
          );
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseEvents(buffer);
          buffer = parsed.remaining;
          for (const ev of parsed.events as Array<
            Record<string, unknown> & { type: string }
          >) {
            if (ev.type === "text") appendReply(String(ev.value ?? ""));
            else if (ev.type === "tool_executed")
              aside(
                asideFor(String(ev.toolId ?? ev.toolName ?? "tool"), "start"),
              );
            else if (ev.type === "tool_completed") {
              const tool = String(ev.toolId ?? ev.toolName ?? "tool");
              if (ev.ok) aside(asideFor(tool, "done"));
              else if (
                typeof ev.message === "string" &&
                /read-only mode/i.test(ev.message)
              )
                aside(
                  `I can't ${asideFor(tool, "start").replace(/^working: /, "")} from a conversation yet`,
                );
              else
                aside(
                  `couldn't ${asideFor(tool, "start").replace(/^working: /, "")}${typeof ev.message === "string" && ev.message ? `: ${ev.message.slice(0, 120)}` : ""}`,
                );
            } else if (ev.type === "tool_pending")
              aside(
                asideFor(String(ev.toolId ?? ev.toolName ?? "tool"), "needs"),
              );
            else if (ev.type === "error")
              aside("something went wrong on my side");
          }
        }
        if (reply.trim()) {
          historyRef.current.push({ role: "assistant", content: reply });
          options.onReply?.(reply);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          aside("I lost the thread there");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
        if (!reply.trim()) options.onStatus?.("quiet");
      }
    },
    [busy, options],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setEntries([]);
    historyRef.current = [];
    try {
      const id = newId();
      window.localStorage.setItem(SESSION_KEY, id);
      sessionRef.current = id;
    } catch {
      sessionRef.current = newId();
    }
  }, []);

  return { entries, busy, send, stop, reset, sessionId: () => session() };
}
