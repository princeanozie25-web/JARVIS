"use client";
// JARVIS · Presence — one screen, three states: presence, conversation, desk.
// See docs/design/PRESENCE_THESIS.md. No cards for tools, no chat balloons,
// no governance words. The brass accent appears only for focus, listening and
// "needs you".
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { decidePresenceAction } from "./actions";
import { Said } from "./Said";
import {
  useChatStream,
  type PresenceStatus,
  type TranscriptEntry,
} from "./use-chat-stream";
import { useVoice } from "./use-voice";

interface PendingRow {
  execution_id: string;
  tool_id: string;
  tool_name: string | null;
  untrusted_client_text: string;
  decision_token: string;
  bound_hash: string;
  operator_token_available: boolean;
  expires_at: number | null;
}

interface DeskThread {
  id: string;
  title: string;
  status_line: string;
  updated_at: number;
  turns: number;
}

// A 15-second clock as an external store: no setState-in-effect, and the
// server snapshot (0) keeps hydration exact. Also doubles as "mounted".
const CLOCK_MS = 15_000;
function clockSnapshot(): number {
  return Math.max(1, Math.floor(Date.now() / CLOCK_MS));
}
function serverClockSnapshot(): number {
  return 0;
}
function subscribeClock(cb: () => void): () => void {
  const t = setInterval(cb, CLOCK_MS);
  return () => clearInterval(t);
}

function timeNow(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
function plainToolName(toolId: string, toolName: string | null): string {
  const map: Record<string, string> = {
    "fs.write_file": "write a file",
    "fs.create_file": "create a file",
    "fs.append_file": "add to a file",
    "fs.mkdir": "make a folder",
    "fs.rename": "rename something",
    "fs.delete_file": "delete a file",
    "memory.note": "keep a note",
    "project.register": "register a project",
    "project.set_status": "change a project's status",
  };
  return map[toolId] ?? (toolName ? toolName.toLowerCase() : toolId);
}

export function PresenceScreen() {
  const [status, setStatus] = useState<PresenceStatus>("quiet");
  const tick = useSyncExternalStore(
    subscribeClock,
    clockSnapshot,
    serverClockSnapshot,
  );
  const mounted = tick > 0;
  const now = useMemo(
    () => (tick > 0 ? new Date(tick * CLOCK_MS) : null),
    [tick],
  );
  const [input, setInput] = useState("");
  const [deskOpen, setDeskOpen] = useState(false);
  const [threads, setThreads] = useState<DeskThread[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [deciding, setDeciding] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const voice = useVoice();
  const speakRef = useRef(voice.speak);
  useEffect(() => {
    speakRef.current = voice.speak;
  }, [voice.speak]);

  const chat = useChatStream(
    useMemo(
      () => ({
        onReply: (text: string) => {
          setStatus("speaking");
          void speakRef.current(text).finally(() => setStatus("quiet"));
        },
        onStatus: (s: PresenceStatus) => setStatus(s),
      }),
      [],
    ),
  );

  const refreshDesk = useCallback(async () => {
    try {
      const res = await fetch("/api/presence/desk");
      if (res.ok) {
        const data = (await res.json()) as { threads: DeskThread[] };
        setThreads(data.threads);
      }
    } catch {
      /* desk is optional */
    }
  }, []);
  const refreshPending = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals/pending");
      if (res.ok) {
        const data = (await res.json()) as { pending: PendingRow[] };
        setPending(data.pending ?? []);
      }
    } catch {
      /* nothing needs you if we cannot tell */
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void refreshPending(), 0);
    const t = setInterval(() => void refreshPending(), 6_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refreshPending]);
  useEffect(() => {
    if (!deskOpen) return;
    const t = setTimeout(() => void refreshDesk(), 0);
    return () => clearTimeout(t);
  }, [deskOpen, refreshDesk]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    voice.hush();
    void chat.send(text);
  }, [chat, input, voice]);

  const holdStart = useCallback(async () => {
    if (!voice.supported) return;
    setStatus("listening");
    await voice.start();
  }, [voice]);
  const holdEnd = useCallback(async () => {
    if (!voice.recording) return;
    setStatus("thinking");
    const text = await voice.stop();
    if (text) void chat.send(text);
    else setStatus("quiet");
  }, [chat, voice]);

  const decide = useCallback(
    async (row: PendingRow, decision: "APPROVED_ONCE" | "DENIED") => {
      setDeciding(true);
      try {
        const outcome = await decidePresenceAction({
          executionId: row.execution_id,
          decision,
          decisionToken: row.decision_token,
          boundHash: row.bound_hash,
        });
        setLastOutcome(
          outcome.ok
            ? decision === "DENIED"
              ? "Left it alone."
              : "Done."
            : outcome.message,
        );
      } finally {
        setDeciding(false);
        void refreshPending();
      }
    },
    [refreshPending],
  );

  const effectiveStatus: PresenceStatus = voice.recording
    ? "listening"
    : voice.speaking
      ? "speaking"
      : status;
  // A row whose token did not survive a server restart can only expire; it
  // must not take the screen. (E-046: fail-closed, never re-mintable.)
  const holding = pending.find((r) => r.operator_token_available) ?? null;
  const headline = useMemo(() => {
    if (holding) return { a: "One thing ", b: "needs you.", c: "" };
    if (chat.entries.length === 0)
      return { a: "Nothing needs you. ", b: "I'm here", c: " when you are." };
    return null;
  }, [holding, chat.entries.length]);

  return (
    <div className="p-root" data-status={effectiveStatus}>
      <header className="p-top">
        <span className="p-mono" suppressHydrationWarning>
          {now ? timeNow(now) : ""}
        </span>
        <span className="p-mono p-status" data-status={effectiveStatus}>
          {effectiveStatus === "quiet" ? "quiet" : effectiveStatus}
        </span>
        <span className="p-top-spacer" />
        <button
          type="button"
          className="p-quiet-btn"
          onClick={() => voice.setEnabled(!voice.enabled)}
          aria-pressed={voice.enabled}
        >
          <span className="p-mono">
            {voice.enabled ? "voice on" : "voice off"}
          </span>
        </button>
        <button
          type="button"
          className="p-quiet-btn"
          onClick={() => setDeskOpen((v) => !v)}
          aria-expanded={deskOpen}
        >
          <span className="p-mono">
            desk{threads.length ? ` · ${threads.length}` : ""}
          </span>
        </button>
      </header>

      <section className="p-stage" data-conversing={chat.entries.length > 0}>
        <button
          type="button"
          className="p-mark"
          data-status={effectiveStatus}
          aria-label={voice.recording ? "Release to send" : "Hold to talk"}
          onPointerDown={(e) => {
            e.preventDefault();
            void holdStart();
          }}
          onPointerUp={() => void holdEnd()}
          onPointerLeave={() => void holdEnd()}
          onKeyDown={(e) => {
            if (e.key === " " && !voice.recording) {
              e.preventDefault();
              void holdStart();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " ") void holdEnd();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="p-mark-img"
            src="/presence/mark-rest.png"
            alt=""
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="p-mark-img p-mark-lit"
            src="/presence/mark-listening.png"
            alt=""
            draggable={false}
          />
        </button>

        {headline ? (
          <h1
            className="p-display p-headline p-arrive"
            style={{ "--p-stagger": "80ms" } as React.CSSProperties}
          >
            {headline.a}
            <em>{headline.b}</em>
            {headline.c}
          </h1>
        ) : (
          <Transcript
            entries={chat.entries}
            thinking={effectiveStatus === "thinking"}
          />
        )}
      </section>

      <form
        className="p-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="p-mono p-composer-label" htmlFor="p-input">
          {mounted && voice.supported
            ? "type, or hold the mark to talk"
            : "type"}
        </label>
        <input
          id="p-input"
          className="p-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={chat.busy && !voice.speaking}
        />
        {voice.lastError ? (
          <span className="p-mono p-error">{voice.lastError}</span>
        ) : null}
        {lastOutcome ? <span className="p-outcome">{lastOutcome}</span> : null}
      </form>

      {holding ? (
        <div className="p-sheet-scrim" role="presentation">
          <section
            className="p-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="p-needs-title"
          >
            <span className="p-mono p-sheet-eyebrow">needs you</span>
            <h2 id="p-needs-title" className="p-display p-sheet-title">
              May I <em>{plainToolName(holding.tool_id, holding.tool_name)}</em>
              ?
            </h2>
            <p className="p-sheet-context">
              <span className="p-mono">what was asked</span>
              <span className="p-fenced">{holding.untrusted_client_text}</span>
            </p>
            <div className="p-sheet-actions">
              <button
                type="button"
                className="p-answer p-answer-yes"
                disabled={deciding || !holding.operator_token_available}
                onClick={() => void decide(holding, "APPROVED_ONCE")}
              >
                Yes, go ahead
              </button>
              <button
                type="button"
                className="p-answer"
                disabled={deciding}
                onClick={() => void decide(holding, "DENIED")}
              >
                No
              </button>
            </div>
            {!holding.operator_token_available ? (
              <span className="p-mono p-error">
                this one can only expire; ask me again
              </span>
            ) : null}
          </section>
        </div>
      ) : null}

      <aside className="p-desk" data-open={deskOpen} aria-hidden={!deskOpen}>
        <div className="p-desk-head">
          <span className="p-mono">desk</span>
          <button
            type="button"
            className="p-quiet-btn"
            onClick={() => setDeskOpen(false)}
          >
            <span className="p-mono">close</span>
          </button>
        </div>
        {threads.length === 0 ? (
          <p className="p-desk-empty p-display">Nothing on the desk yet.</p>
        ) : (
          <ol className="p-threads">
            {threads.map((t) => (
              <li key={t.id} className="p-thread">
                <span className="p-thread-title">{t.title}</span>
                <span className="p-thread-status">{t.status_line}</span>
                <span className="p-mono p-thread-meta" suppressHydrationWarning>
                  {now ? ago(t.updated_at, now.getTime()) : ""} · {t.turns}{" "}
                  turns
                </span>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          className="p-quiet-btn p-desk-new"
          onClick={() => {
            chat.reset();
            setDeskOpen(false);
          }}
        >
          <span className="p-mono">new thread</span>
        </button>
      </aside>
    </div>
  );
}

function Transcript({
  entries,
  thinking,
}: {
  entries: TranscriptEntry[];
  thinking: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastText = entries[entries.length - 1]?.text;
  useEffect(() => {
    const el = document.scrollingElement ?? document.documentElement;
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [entries.length, lastText]);
  return (
    <div className="p-transcript" aria-live="polite">
      {entries.map((e) =>
        e.role === "aside" ? (
          <p key={e.id} className="p-aside">
            {e.text}
          </p>
        ) : (
          <div key={e.id} className="p-turn" data-role={e.role}>
            <span className="p-mono p-speaker">
              {e.role === "you" ? "you" : "jarvis"}
            </span>
            {e.role === "jarvis" ? (
              <div className="p-said p-display">
                <Said text={e.text} />
              </div>
            ) : (
              <p className="p-said">{e.text}</p>
            )}
          </div>
        ),
      )}
      {thinking ? <p className="p-aside p-thinking">thinking</p> : null}
      <div ref={endRef} />
    </div>
  );
}
