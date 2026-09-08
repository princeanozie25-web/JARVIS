"use client";
// JARVIS · Presence — iMessage-shaped: a sidebar with JARVIS and the threads,
// the thread itself, and a pinned activity panel you can close. See
// docs/design/PRESENCE_THESIS.md. Prose where prose fits, a small structured
// block where it does not (what it is doing, what needs you). Status lives in
// the avatar first, the panel second, never a takeover.
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

// The standing brief: what JARVIS posts into a fresh thread at rest.
interface Brief {
  threadId: string;
  greeting: string;
  text: string;
  at: number;
}

type AvatarStatus = PresenceStatus | "needs";

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

const PANEL_KEY = "jarvis.presence.panel";

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
function whenShort(ms: number, now: number): string {
  const d = new Date(ms);
  const n = new Date(now);
  const sameDay = d.toDateString() === n.toDateString();
  if (sameDay) return timeOf(ms);
  const days = Math.round((now - ms) / 86_400_000);
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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

function Icon({
  name,
}: {
  name: "plus" | "mic" | "up" | "speaker" | "panel" | "side" | "close";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      );
    case "up":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M12 19V6M6 12l6-6 6 6" />
        </svg>
      );
    case "speaker":
      return (
        <svg {...common}>
          <path d="M4 10v4h3l5 4V6L7 10H4z" />
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M15 5v14" />
        </svg>
      );
    case "side":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M9 5v14" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
  }
}

export function PresenceScreen() {
  const [status, setStatus] = useState<PresenceStatus>("quiet");
  const tick = useSyncExternalStore(
    subscribeClock,
    clockSnapshot,
    serverClockSnapshot,
  );
  const mounted = tick > 0;
  const now = tick > 0 ? tick * CLOCK_MS : 0;
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [threads, setThreads] = useState<DeskThread[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [deciding, setDeciding] = useState(false);
  const voice = useVoice();
  const speakRef = useRef(voice.speak);
  useEffect(() => {
    speakRef.current = voice.speak;
  }, [voice.speak]);

  const refreshThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/presence/desk");
      if (res.ok) {
        const data = (await res.json()) as { threads: DeskThread[] };
        setThreads(data.threads);
      }
    } catch {
      /* the list is optional */
    }
  }, []);
  // At rest, JARVIS speaks first: the brief is fetched for a thread that has
  // no history yet and stays at its top for as long as that thread is open.
  const fetchBrief = useCallback(async (threadId: string) => {
    try {
      const res = await fetch("/api/presence/brief");
      if (!res.ok) return;
      const data = (await res.json()) as {
        greeting: string;
        text: string;
        generated_at: string;
      };
      setBrief({
        threadId,
        greeting: data.greeting,
        text: data.text,
        at: Date.parse(data.generated_at) || Date.now(),
      });
    } catch {
      /* then the thread simply starts empty */
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

  const chat = useChatStream(
    useMemo(
      () => ({
        onReply: (text: string) => {
          setStatus("speaking");
          void speakRef.current(text).finally(() => setStatus("quiet"));
        },
        onStatus: (s: PresenceStatus) => setStatus(s),
        onNeeds: () => void refreshPending(),
        onTurnEnd: () => void refreshThreads(),
      }),
      [refreshPending, refreshThreads],
    ),
  );

  useEffect(() => {
    const first = setTimeout(() => {
      // The same conversation continues: reopen the remembered thread.
      const id = chat.sessionId();
      void (async () => {
        try {
          const res = await fetch(
            `/api/presence/thread/${encodeURIComponent(id)}`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as { messages: TranscriptEntry[] };
          if (data.messages.length > 0) chat.load(id, data.messages);
          else void fetchBrief(id);
        } catch {
          /* start fresh */
        }
      })();
      void refreshPending();
      void refreshThreads();
      try {
        if (window.localStorage.getItem(PANEL_KEY) === "open")
          setPanelOpen(true);
      } catch {
        /* per-viewer convenience only */
      }
    }, 0);
    const t = setInterval(() => void refreshPending(), 6_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
    // chat.sessionId/load are stable for the life of the screen; this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshPending, refreshThreads]);

  const togglePanel = useCallback(() => {
    setPanelOpen((v) => {
      try {
        window.localStorage.setItem(PANEL_KEY, v ? "closed" : "open");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }, []);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    voice.hush();
    void chat.send(text);
  }, [chat, input, voice]);

  const holdStart = useCallback(async () => {
    if (!voice.supported || voice.recording || chat.busy) return;
    setStatus("listening");
    await voice.start();
  }, [chat.busy, voice]);
  const holdEnd = useCallback(async () => {
    if (!voice.recording) return;
    setStatus("thinking");
    const text = await voice.stop();
    if (text) void chat.send(text);
    else setStatus("quiet");
  }, [chat, voice]);

  // Hold ⌥ anywhere to talk; let go to send.
  const holdRef = useRef({ start: holdStart, end: holdEnd });
  useEffect(() => {
    holdRef.current = { start: holdStart, end: holdEnd };
  }, [holdStart, holdEnd]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Alt" && !e.repeat) {
        e.preventDefault();
        void holdRef.current.start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt") void holdRef.current.end();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const openThread = useCallback(
    async (id: string) => {
      setSideOpen(false);
      if (id === chat.threadId) return;
      voice.hush();
      try {
        const res = await fetch(
          `/api/presence/thread/${encodeURIComponent(id)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: TranscriptEntry[] };
        chat.load(id, data.messages);
        setStatus("quiet");
      } catch {
        /* stay where we are */
      }
    },
    [chat, voice],
  );

  const newThread = useCallback(() => {
    voice.hush();
    chat.reset();
    setStatus("quiet");
    setSideOpen(false);
    void fetchBrief(chat.sessionId());
  }, [chat, fetchBrief, voice]);

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
        // The backend's refusal messages are for its logs, not for the thread.
        chat.note(
          outcome.ok
            ? decision === "DENIED"
              ? "left it alone"
              : "went ahead"
            : "that didn't go through; ask me again",
        );
      } finally {
        setDeciding(false);
        void refreshPending();
      }
    },
    [chat, refreshPending],
  );

  const effectiveStatus: PresenceStatus = voice.recording
    ? "listening"
    : voice.speaking
      ? "speaking"
      : status;
  // A row whose token did not survive a server restart can only expire; it
  // must not take the screen. (E-046: fail-closed, never re-mintable.)
  const holding = pending.find((r) => r.operator_token_available) ?? null;
  const avatarStatus: AvatarStatus = holding ? "needs" : effectiveStatus;
  const lastAside = useMemo(() => {
    for (let i = chat.entries.length - 1; i >= 0; i -= 1) {
      const e = chat.entries[i]!;
      if (e.role === "aside") return e.text;
      if (e.role === "jarvis") break;
    }
    return null;
  }, [chat.entries]);
  const statusLine = holding
    ? "Needs you"
    : effectiveStatus === "listening"
      ? "Listening"
      : effectiveStatus === "thinking"
        ? lastAside
          ? capitalise(lastAside)
          : "Working"
        : effectiveStatus === "speaking"
          ? "Speaking"
          : "Nothing needs you";
  const activeThread = threads.find((t) => t.id === chat.threadId) ?? null;
  const canSend = input.trim().length > 0;

  return (
    <div
      className="p-root"
      data-status={effectiveStatus}
      data-panel={panelOpen}
      data-side={sideOpen}
    >
      <nav className="p-side" aria-label="Threads">
        <div className="p-side-head">
          <span className="p-side-title">Threads</span>
          <button
            type="button"
            className="p-icon-btn"
            onClick={newThread}
            aria-label="New thread"
            title="New thread"
          >
            <Icon name="plus" />
          </button>
        </div>
        <button
          type="button"
          className="p-me"
          onClick={togglePanel}
          aria-expanded={panelOpen}
          aria-label={`JARVIS, ${statusLine.toLowerCase()}`}
        >
          <span className="p-dot" data-status={avatarStatus} />
          <span className="p-me-text">
            <span className="p-me-name">JARVIS</span>
            <span className="p-me-sub" data-status={avatarStatus}>
              {statusLine}
            </span>
          </span>
        </button>
        <span className="p-side-label">Recent</span>
        {threads.length === 0 ? (
          <p className="p-side-empty">Nothing yet.</p>
        ) : (
          <ol className="p-threads">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="p-thread"
                  aria-current={t.id === chat.threadId ? "true" : undefined}
                  onClick={() => void openThread(t.id)}
                >
                  <span className="p-thread-title">{t.title}</span>
                  <span
                    className="p-mono p-thread-time"
                    suppressHydrationWarning
                  >
                    {now ? whenShort(t.updated_at, now) : ""}
                  </span>
                  <span className="p-thread-status">{t.status_line}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </nav>

      <section className="p-main" aria-label="Conversation">
        <header className="p-bar">
          <button
            type="button"
            className="p-icon-btn p-side-toggle"
            onClick={() => setSideOpen((v) => !v)}
            aria-expanded={sideOpen}
            aria-label="Threads"
          >
            <Icon name="side" />
          </button>
          <span className="p-bar-title">JARVIS</span>
          <div className="p-bar-tools">
            <button
              type="button"
              className="p-icon-btn"
              onClick={() => voice.setEnabled(!voice.enabled)}
              aria-pressed={voice.enabled}
              aria-label={voice.enabled ? "Voice on" : "Voice off"}
              title={voice.enabled ? "Voice on" : "Voice off"}
              style={{ opacity: voice.enabled ? 1 : 0.45 }}
            >
              <Icon name="speaker" />
            </button>
            <button
              type="button"
              className="p-icon-btn"
              onClick={togglePanel}
              aria-expanded={panelOpen}
              aria-label="Activity"
              title="Activity"
            >
              <Icon name="panel" />
            </button>
          </div>
        </header>

        <Transcript
          entries={chat.entries}
          thinking={effectiveStatus === "thinking"}
          live={lastAside}
          brief={brief && brief.threadId === chat.threadId ? brief : null}
        >
          {holding ? (
            <section
              className="p-needs p-arrive"
              data-needs-you
              aria-labelledby="p-needs-title"
            >
              <span className="p-needs-eyebrow">Needs you</span>
              <h2 id="p-needs-title" className="p-needs-title">
                May I {plainToolName(holding.tool_id, holding.tool_name)}?
              </h2>
              <p className="p-needs-context">{holding.untrusted_client_text}</p>
              <div className="p-needs-actions">
                <button
                  type="button"
                  className="p-btn p-btn-primary"
                  disabled={deciding || !holding.operator_token_available}
                  onClick={() => void decide(holding, "APPROVED_ONCE")}
                >
                  Yes, go ahead
                </button>
                <button
                  type="button"
                  className="p-btn"
                  disabled={deciding}
                  onClick={() => void decide(holding, "DENIED")}
                >
                  No
                </button>
              </div>
            </section>
          ) : null}
        </Transcript>

        <form
          className="p-composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="p-field" data-recording={voice.recording}>
            <input
              id="p-input"
              className="p-input"
              aria-label="Say something to JARVIS"
              placeholder={
                voice.recording
                  ? "Listening…"
                  : mounted && voice.supported
                    ? "Type, or hold ⌥ to talk"
                    : "Type"
              }
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
              disabled={(chat.busy && !voice.speaking) || voice.recording}
            />
            {canSend ? (
              <button
                type="submit"
                className="p-mic"
                data-mode="send"
                aria-label="Send"
                disabled={chat.busy && !voice.speaking}
              >
                <Icon name="up" />
              </button>
            ) : (
              <button
                type="button"
                className="p-mic"
                data-mode="talk"
                data-recording={voice.recording}
                aria-label={
                  voice.recording ? "Release to send" : "Hold to talk"
                }
                disabled={!mounted || !voice.supported}
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
                <Icon name="mic" />
              </button>
            )}
          </div>
          {voice.lastError ? (
            <p className="p-caption p-composer-note">{voice.lastError}</p>
          ) : null}
        </form>
      </section>

      <aside className="p-panel" aria-label="Activity" aria-hidden={!panelOpen}>
        <div className="p-panel-inner">
          <div className="p-panel-head">
            <span className="p-panel-title">Activity</span>
            <button
              type="button"
              className="p-icon-btn"
              onClick={togglePanel}
              aria-label="Close"
              tabIndex={panelOpen ? 0 : -1}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="p-panel-now">
            <span className="p-panel-now-status">
              <span className="p-dot" data-status={avatarStatus} />
              {statusLine}
            </span>
            <span className="p-panel-now-sub">
              {activeThread
                ? `${activeThread.turns} turns in this thread`
                : "New thread"}
            </span>
          </div>
          {chat.entries.length === 0 ? (
            <p className="p-panel-empty">
              What I do in this thread shows up here as it happens.
            </p>
          ) : (
            <ol className="p-timeline">
              {chat.entries.map((e) => (
                <li key={e.id} data-you={e.role === "you"}>
                  <span className="p-mono" suppressHydrationWarning>
                    {timeOf(e.at)}
                  </span>
                  <span>
                    {e.role === "aside"
                      ? capitalise(e.text)
                      : e.role === "you"
                        ? `You: ${clip(e.text, 90)}`
                        : `Said: ${clip(e.text, 90)}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

// Consecutive asides become one small block; you and JARVIS stay as they are.
type Block =
  | { kind: "turn"; entry: TranscriptEntry }
  | { kind: "acts"; id: string; items: TranscriptEntry[] };
function toBlocks(entries: TranscriptEntry[]): Block[] {
  const out: Block[] = [];
  for (const e of entries) {
    if (e.role !== "aside") {
      out.push({ kind: "turn", entry: e });
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.kind === "acts") last.items.push(e);
    else out.push({ kind: "acts", id: e.id, items: [e] });
  }
  return out;
}

function Transcript({
  entries,
  thinking,
  live,
  brief,
  children,
}: {
  entries: TranscriptEntry[];
  thinking: boolean;
  live: string | null;
  brief: Brief | null;
  children?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastText = entries[entries.length - 1]?.text;
  const hasChild = children !== null && children !== undefined;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [entries.length, lastText, thinking, hasChild]);
  const blocks = useMemo(() => toBlocks(entries), [entries]);
  const showWorking = thinking && !live;
  return (
    <div className="p-scroll" ref={scrollRef}>
      <div className="p-transcript" aria-live="polite">
        {brief ? (
          <>
            <span className="p-when p-mono" suppressHydrationWarning>
              Today {timeOf(brief.at)}
            </span>
            <div className="p-jarvis p-brief">
              <p className="p-brief-greeting">{brief.greeting}</p>
              <Said text={brief.text} />
            </div>
          </>
        ) : null}
        {blocks.map((b, i) => {
          if (b.kind === "acts") {
            const isLast = i === blocks.length - 1;
            return (
              <div key={b.id} className="p-acts">
                {b.items.map((a, j) => (
                  <span
                    key={a.id}
                    className="p-act"
                    data-live={thinking && isLast && j === b.items.length - 1}
                  >
                    {a.text}
                  </span>
                ))}
              </div>
            );
          }
          const e = b.entry;
          return e.role === "you" ? (
            <div key={e.id} className="p-you">
              {e.text}
            </div>
          ) : (
            <div key={e.id} className="p-jarvis">
              <Said text={e.text} />
            </div>
          );
        })}
        {showWorking ? (
          <div className="p-acts">
            <span className="p-act" data-live="true">
              working
            </span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
