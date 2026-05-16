"""Generate the JARVIS v3.1 codebase audit (streaming checkpoint) as a PDF."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
)

OUTPUT = r"C:\Users\princ\Documents\jarvis\docs\JARVIS_Audit_2026-05-16.pdf"

# ---------- Styles ----------
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "TitleX",
    parent=styles["Title"],
    fontSize=22,
    leading=26,
    spaceAfter=6,
    textColor=colors.HexColor("#0b0b0b"),
)
subtitle_style = ParagraphStyle(
    "Subtitle",
    parent=styles["Normal"],
    fontSize=10,
    textColor=colors.HexColor("#666666"),
    spaceAfter=18,
)
h1 = ParagraphStyle(
    "H1",
    parent=styles["Heading1"],
    fontSize=15,
    leading=20,
    spaceBefore=14,
    spaceAfter=8,
    textColor=colors.HexColor("#111111"),
)
h2 = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontSize=12,
    leading=16,
    spaceBefore=10,
    spaceAfter=4,
    textColor=colors.HexColor("#222222"),
)
body = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontSize=10,
    leading=14,
    spaceAfter=6,
    alignment=TA_LEFT,
)
bullet = ParagraphStyle(
    "Bullet",
    parent=body,
    leftIndent=14,
    bulletIndent=2,
    spaceAfter=3,
)
code_style = ParagraphStyle(
    "Code",
    parent=styles["Code"],
    fontSize=8.5,
    leading=11,
    backColor=colors.HexColor("#f4f4f4"),
    borderColor=colors.HexColor("#dddddd"),
    borderWidth=0.5,
    borderPadding=6,
    spaceAfter=8,
)
callout_style = ParagraphStyle(
    "Callout",
    parent=body,
    backColor=colors.HexColor("#eef6ff"),
    borderColor=colors.HexColor("#3b82f6"),
    borderWidth=1,
    borderPadding=8,
    spaceAfter=10,
)


def P(text, style=body):
    return Paragraph(text, style)


def H1(text):
    return Paragraph(text, h1)


def H2(text):
    return Paragraph(text, h2)


def B(text):
    return Paragraph("&bull;&nbsp;&nbsp;" + text, bullet)


def CODE(text):
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe = safe.replace("\n", "<br/>").replace(" ", "&nbsp;")
    return Paragraph(safe, code_style)


def table(data, col_widths=None, header_bg="#222222"):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_bg)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ])
    t.setStyle(style)
    return t


# ---------- Content ----------
story = []

story.append(P("JARVIS Codebase Audit &mdash; Streaming Checkpoint", title_style))
story.append(P(
    "Baseline: ARCHITECTURE.md v3.1 (14 May 2026) &nbsp;|&nbsp; "
    "Audit date: 16 May 2026 &nbsp;|&nbsp; "
    "Auditor: Claude Opus 4.7 &nbsp;|&nbsp; "
    "Repo: jarvis @ main (1f8b762)",
    subtitle_style,
))

# ---------- Executive Summary ----------
story.append(H1("Executive Summary"))
story.append(P(
    "Since the first audit (16 May, commit afb35f2), ten commits have landed and most of the prior P0/P1 list is "
    "closed. The provider layer is now a registry of <font face='Courier'>ChatProvider</font> implementations; the "
    "route validates input with Zod, enforces an in-memory rate limit, gates calls through a cost guard, loads the "
    "system prompt with a content hash, records a telemetry event on success/failure, and streams the model output "
    "back as <font face='Courier'>text/plain</font> through a <font face='Courier'>ReadableStream</font>. The client "
    "consumes the stream incrementally and renders tokens as they arrive."
))
story.append(P(
    "<b>This checkpoint asks a different question:</b> is that streaming layer ready to take Anthropic, sentence "
    "chunking, TTS, tool-calls, and the SSE/event multiplexing v3.1 implies &mdash; or does it lock in technical "
    "debt? The answer is: <b>the abstraction is the right shape for token streaming today, but the wire format "
    "(<font face='Courier'>text/plain</font>) and the stream payload type (<font face='Courier'>AsyncIterable&lt;"
    "string&gt;</font>) are both one-channel choices that the architecture's next four phases will outgrow.</b> "
    "Fix the payload type and switch the wire to SSE (or NDJSON) before Anthropic lands. Both are small, local "
    "changes today; both are large, cross-cutting refactors after a second provider exists."
))
story.append(P(
    "<b>Verdict:</b> The Phase 1.5 gate proposed in the prior audit is now ~80% done. Two streaming-shaped fixes "
    "(typed stream events + SSE wire format) remain before Phase 1B (Anthropic) can land without re-opening every "
    "consumer.",
    callout_style,
))

# ---------- What Changed Since The Prior Audit ----------
story.append(H1("1. What Changed Since the Prior Audit"))
story.append(P("Ten commits, all in the direction of the prior fix list. Status of the prior P0/P1 items:"))

delta = [
    ["#", "Prior P0/P1 item", "Status now", "Evidence"],
    ["1", "Rotate exposed API keys", "OUT OF SCOPE for this audit", "User-side action; cannot verify from repo"],
    ["2", "Cost guard with daily/weekly/monthly caps", "DONE", "src/lib/cost/* &mdash; guard.ts checks each window before request; usage.record() called on stream completion"],
    ["3", "Zod validation on /api/chat", "DONE", "ChatRequestSchema in route.ts; safeParse + 400 with issues"],
    ["4", "Rate limit on /api/chat", "DONE", "src/lib/rate-limit/* &mdash; 20 req / 60s sliding window, keyed by x-forwarded-for or x-real-ip"],
    ["5", "Client error path (don't render error JSON as assistant message)", "DONE", "app/page.tsx checks res.ok before reading the body and renders a separate red error block"],
    ["6", "Fail fast if API keys missing", "PARTIAL", "config.ts still uses || \"\" pattern; no boot-time assertion"],
    ["7", "System prompt under prompts/ with hash logging", "DONE", "prompts/jarvis_system.md exists; loader hashes content and route logs the hash on success"],
    ["8", "Stack decision (TS-first vs Python-core)", "IMPLICIT", "TS-first is the de facto answer; ARCHITECTURE.md still claims Python &mdash; reconcile"],
    ["9", "ChatProvider interface", "DONE", "src/lib/providers/types.ts &mdash; generate() and stream() on a single interface"],
    ["10", "Refactor openai.ts to implement the interface", "DONE", "OpenAIProvider class; registered in registry.ts"],
    ["11", "Streaming from route, incremental in client", "DONE (with caveats &mdash; see Section 3)", "ReadableStream + text/plain in route; getReader() + TextDecoder in client"],
    ["12", "SQLite telemetry per v3.1 §17", "PARTIAL", "In-memory store with the right shape but missing fields and not persisted; ring-buffer caps at 1000"],
    ["13", "Registry-driven model ids", "PARTIAL", "Registry exists for providers, but model strings still live in config.ts"],
    ["14", "Fix Anthropic model id (claude-opus-4-1 &rarr; current)", "OPEN", "config.ts still says claude-opus-4-1"],
    ["15", "Cap conversation length / summarise at N turns", "OPEN", "Client still re-uploads full history each turn"],
    ["16", "Persist sessions to SQLite, not useState", "OPEN", "Still client-only state"],
    ["17", "tsconfig path mapping", "DONE", "Now @/* &rarr; ./src/* &mdash; consistent with conventions"],
]
story.append(table(delta, col_widths=[0.3*inch, 1.8*inch, 1.1*inch, 3.5*inch]))

story.append(PageBreak())

# ---------- Streaming Audit ----------
story.append(H1("2. Streaming Architecture &mdash; What's in the Repo Today"))

story.append(H2("2.1 Provider stream abstraction"))
story.append(P(
    "<font face='Courier'>src/lib/providers/types.ts</font> defines:"
))
story.append(CODE(
    "export interface StreamResult {\n"
    "  stream: AsyncIterable<string>;\n"
    "  done: Promise<GenerateResult>;\n"
    "}\n\n"
    "export interface ChatProvider {\n"
    "  readonly id: ProviderId;\n"
    "  generate(messages: Message[], opts: GenerateOptions): Promise<GenerateResult>;\n"
    "  stream(messages: Message[], opts: GenerateOptions): Promise<StreamResult>;\n"
    "}"
))
story.append(P(
    "<font face='Courier'>OpenAIProvider.stream()</font> creates an SDK stream with "
    "<font face='Courier'>stream_options: { include_usage: true }</font>, returns an async generator that yields "
    "<font face='Courier'>delta.content</font> strings, and resolves <font face='Courier'>done</font> with the "
    "final <font face='Courier'>GenerateResult</font> (content, modelId, input/output tokens, costUsd, latencyMs) "
    "after the last chunk."
))

story.append(H2("2.2 Route streaming"))
story.append(P(
    "<font face='Courier'>app/api/chat/route.ts</font> wraps the provider stream in a "
    "<font face='Courier'>ReadableStream&lt;Uint8Array&gt;</font>, encodes each yielded string with "
    "<font face='Courier'>TextEncoder</font>, and returns it with "
    "<font face='Courier'>Content-Type: text/plain; charset=utf-8</font>, "
    "<font face='Courier'>Cache-Control: no-cache, no-transform</font>, "
    "<font face='Courier'>X-Content-Type-Options: nosniff</font>. After the iterator drains, the route awaits "
    "<font face='Courier'>streamResult.done</font>, records cost, and emits a <font face='Courier'>model_call</font> "
    "telemetry event. On error inside the iterator, it emits <font face='Courier'>provider_error</font> and calls "
    "<font face='Courier'>controller.error()</font>."
))

story.append(H2("2.3 Frontend streaming"))
story.append(P(
    "<font face='Courier'>app/page.tsx</font> uses <font face='Courier'>res.body.getReader()</font> + "
    "<font face='Courier'>TextDecoder({ stream: true })</font>, appends each decoded chunk to "
    "<font face='Courier'>assistantContent</font>, and re-sets the messages array on every chunk to render the "
    "tail message progressively."
))

# ---------- Critical findings ----------
story.append(H1("3. Streaming Findings &mdash; What Will Bite You at Phase 1B"))

story.append(H2("3.1 The stream payload type cannot carry non-text events"))
story.append(P(
    "<font face='Courier'>AsyncIterable&lt;string&gt;</font> is a single-channel pipe. Today, only token deltas "
    "flow through it. Tomorrow, all of the following need to flow through the same pipe:"
))
story.append(B("<b>Anthropic structured events</b> &mdash; <font face='Courier'>message_start</font>, <font face='Courier'>content_block_start</font>, <font face='Courier'>content_block_delta</font>, <font face='Courier'>content_block_stop</font>, <font face='Courier'>message_delta</font>, <font face='Courier'>message_stop</font>. The current provider would collapse all of these into bare strings, discarding the structure."))
story.append(B("<b>Tool-call streaming</b> (Anthropic <font face='Courier'>tool_use</font> blocks, OpenAI <font face='Courier'>tool_calls</font> deltas). These are not text. They have ids, names, and incrementally-streamed JSON args. A string stream cannot represent them."))
story.append(B("<b>Sentence boundaries</b> for v3.1 &sect;8.1 TTS dispatch. Sentence-chunking lives <i>downstream</i> of the provider, but it needs an event saying \"this is the end of a content block\" &mdash; otherwise it can't flush the last sentence reliably."))
story.append(B("<b>Mid-stream errors with structured metadata</b> (rate-limit, model overloaded, safety stop). Today: <font face='Courier'>controller.error()</font> after HTTP 200 is already on the wire &mdash; the client sees a truncated reply with no error code."))
story.append(B("<b>Heartbeats / status</b> (\"thinking\", \"using tool X\", \"running RAG\"). Useful for the UI; impossible without typed events."))

story.append(P("<b>Recommended shape</b> (concrete enough to implement this week):"))
story.append(CODE(
    "export type StreamEvent =\n"
    "  | { type: 'text';            value: string }\n"
    "  | { type: 'tool_call_start'; id: string; name: string }\n"
    "  | { type: 'tool_call_delta'; id: string; argsJsonChunk: string }\n"
    "  | { type: 'tool_call_end';   id: string }\n"
    "  | { type: 'usage';           inputTokens: number; outputTokens: number }\n"
    "  | { type: 'error';           message: string; recoverable: boolean }\n"
    "  | { type: 'done';            result: GenerateResult };\n\n"
    "export interface StreamResult {\n"
    "  events: AsyncIterable<StreamEvent>;\n"
    "  // 'done' Promise is optional now &mdash; the last event already carries the result.\n"
    "}"
))
story.append(P(
    "Migration cost <b>today</b>: one provider, one route, one client. Migration cost <b>after Anthropic lands</b>: "
    "two providers, every consumer, both telemetry and TTS pipelines that haven't been built yet but were designed "
    "against the old shape. The size of this change roughly doubles per phase."
))

story.append(H2("3.2 text/plain is the wrong wire format for what comes next"))
story.append(P(
    "<font face='Courier'>text/plain</font> works for the current single-channel case. It cannot represent the "
    "typed events from 3.1, so as soon as the payload type changes, the wire has to change too. Three options, in "
    "increasing order of headroom:"
))

wire_options = [
    ["Option", "How it looks", "Pros", "Cons"],
    [
        "NDJSON",
        "One JSON object per line: <font face='Courier'>{\"type\":\"text\",\"value\":\"hi\"}\\n</font>",
        "Trivial to parse; fits ReadableStream; no special browser support needed",
        "No native EventSource client; you write the parser; no automatic reconnect"
    ],
    [
        "SSE (text/event-stream)",
        "<font face='Courier'>event: text\\ndata: {\"value\":\"hi\"}\\n\\n</font>",
        "Native <font face='Courier'>EventSource</font> client; built-in reconnection; comment heartbeats; standardised; matches v3.1 §8 spirit",
        "EventSource is GET-only &mdash; for POST streaming you keep fetch + a small SSE parser (Anthropic SDK does this)"
    ],
    [
        "WebSocket",
        "Bidirectional frames",
        "Bidirectional &mdash; useful when STT/voice arrives",
        "Heavier; doesn't survive Vercel edge cleanly; overkill for chat"
    ],
]
story.append(table(wire_options, col_widths=[0.9*inch, 2.2*inch, 1.9*inch, 1.7*inch]))
story.append(P(
    "<b>Recommendation:</b> SSE, with fetch + a hand-rolled parser on the client (same pattern the Anthropic and "
    "OpenAI SDKs use internally). It is the cheapest wire that carries typed events and survives Phase 4 voice "
    "streaming without another migration."
))

story.append(H2("3.3 AbortSignal is not threaded anywhere"))
story.append(P(
    "<font face='Courier'>provider.stream()</font> takes no <font face='Courier'>signal</font>. The route never "
    "watches <font face='Courier'>req.signal</font>. The client cannot cancel. The route also cannot detect a "
    "client disconnect and stop iterating &mdash; the OpenAI SDK will happily keep streaming tokens you'll pay for "
    "that nobody is reading. This is a real cost leak the moment a user closes the tab on a long generation."
))
story.append(B("Add <font face='Courier'>signal?: AbortSignal</font> to <font face='Courier'>GenerateOptions</font>."))
story.append(B("Pass <font face='Courier'>req.signal</font> through to <font face='Courier'>provider.stream()</font>."))
story.append(B("Listen to <font face='Courier'>req.signal.addEventListener('abort', &hellip;)</font> in the ReadableStream's <font face='Courier'>cancel()</font> hook and propagate."))
story.append(B("Add a <b>Stop</b> button on the client with an <font face='Courier'>AbortController</font>."))
story.append(B("Record a <font face='Courier'>client_disconnect</font> telemetry event so cost-leak protection is observable."))

story.append(H2("3.4 No time-to-first-token captured"))
story.append(P(
    "v3.1 &sect;7 sets first-token P95 budgets per tier (T3: &lt;1.5s; T4: &lt;3s). Today the only latency recorded "
    "is end-to-end &mdash; the metric the architecture cares about most for streaming is unmeasured. Add "
    "<font face='Courier'>time_to_first_token_ms</font> to <font face='Courier'>GenerateResult</font> and to the "
    "telemetry event. Capture it inside the provider iterator on the first non-empty content delta."
))

story.append(H2("3.5 Sentence-chunker has no home yet"))
story.append(P(
    "v3.1 &sect;8.1 puts sentence buffering between the LLM stream and the TTS stream. It is provider-agnostic but "
    "deeply stream-coupled. The right home is "
    "<font face='Courier'>src/lib/streaming/sentence_chunker.ts</font> &mdash; a transformer that consumes "
    "<font face='Courier'>AsyncIterable&lt;StreamEvent&gt;</font> and yields "
    "<font face='Courier'>AsyncIterable&lt;SentenceEvent&gt;</font>. This module does not need to exist before "
    "Phase 4 (voice), but the <i>event shape</i> it consumes has to be settled in 3.1's fix so the chunker can be "
    "added later without touching providers."
))

story.append(H2("3.6 done Promise + iterable is awkward, not load-bearing"))
story.append(P(
    "If a consumer breaks out of the for-await loop (e.g., on client disconnect), <font face='Courier'>done</font> "
    "never resolves, leaving a dangling Promise. Today the route never breaks out, so this is latent. Replacing it "
    "with a terminal <font face='Courier'>{type:'done', result}</font> event removes the dangling-Promise shape "
    "and aligns with the SSE model (the stream is the source of truth; there is no out-of-band channel)."
))

story.append(H2("3.7 PLACEHOLDER_COST_PER_REQUEST_USD = 0.001"))
story.append(P(
    "Cost is a flat $0.001 per call regardless of token usage. The cost guard is therefore measuring something "
    "approximately unrelated to reality. Replace with a per-model rate from the registry, multiplied by actual "
    "<font face='Courier'>inputTokens</font> / <font face='Courier'>outputTokens</font> from the streamed usage chunk. "
    "Fixed-rate caps cannot enforce real spend &mdash; v3.1 &sect;16 is unmet in spirit even though the code path exists."
))

story.append(PageBreak())

# ---------- Telemetry ----------
story.append(H1("4. Telemetry Compatibility"))

story.append(H2("4.1 What works"))
story.append(B("Stream success path records <font face='Courier'>model_call</font> with model id, latency, cost, and tokens (in the notes field)."))
story.append(B("Failure paths record <font face='Courier'>validation_failure</font>, <font face='Courier'>rate_limited</font>, <font face='Courier'>cost_denied</font>, <font face='Courier'>provider_error</font>."))
story.append(B("Streamed usage from <font face='Courier'>stream_options.include_usage</font> is captured on the final chunk."))

story.append(H2("4.2 What diverges from v3.1 §17"))
story.append(P("v3.1 §17 specifies an SQLite events table with these fields:"))
story.append(CODE(
    "id, ts, session_id, event_type, intent, safety_tag, tier, model_id,\n"
    "tool_name, input_tokens, output_tokens, cost_usd, latency_ms, success,\n"
    "error_class, user_rating, notes"
))
story.append(P("Current <font face='Courier'>TelemetryEvent</font>:"))
story.append(CODE(
    "timestamp, event_type, success, model_id?, latency_ms?, cost_usd?, error_class?, notes?"
))
story.append(P("Missing or collapsed into <font face='Courier'>notes</font>:"))
story.append(B("<font face='Courier'>id</font> &mdash; no event id; can't reference an event from elsewhere"))
story.append(B("<font face='Courier'>session_id</font> &mdash; no notion of a session yet (also blocks v3.1 §15 memory)"))
story.append(B("<font face='Courier'>intent</font>, <font face='Courier'>safety_tag</font>, <font face='Courier'>tier</font> &mdash; router fields, not relevant until Phase 1D, but the column should exist"))
story.append(B("<font face='Courier'>tool_name</font> &mdash; not relevant yet, same note"))
story.append(B("<font face='Courier'>input_tokens</font>, <font face='Courier'>output_tokens</font> &mdash; currently stuffed into <font face='Courier'>notes</font> as a free-text string; can't be queried"))
story.append(B("<font face='Courier'>user_rating</font> &mdash; v3.1 §4.5 quality threshold depends on this; no UI for it either"))

story.append(H2("4.3 What the streaming work specifically needs added"))
story.append(B("<font face='Courier'>time_to_first_token_ms</font> &mdash; first-token latency, per §3.4 above"))
story.append(B("<font face='Courier'>stream_outcome</font>: <font face='Courier'>'completed' | 'client_aborted' | 'error_before_first_token' | 'error_mid_stream'</font> &mdash; distinguishes recoverable from unrecoverable failures"))
story.append(B("<font face='Courier'>bytes_streamed</font> / <font face='Courier'>chunks_streamed</font> &mdash; helps debug throughput issues"))

story.append(H2("4.4 Storage shape"))
story.append(P(
    "<font face='Courier'>InMemoryTelemetryStore</font> is fine for development &mdash; the contract is "
    "<font face='Courier'>TelemetryStore</font> and can be swapped for a SQLite implementation without touching "
    "the route. The ring-buffer cap at 1000 silently drops oldest events; for now, add a console warning when "
    "trimming so this doesn't hide. Promotion to <font face='Courier'>better-sqlite3</font> can wait until Phase "
    "1.5 has a session_id to write."
))

story.append(PageBreak())

# ---------- Other issues ----------
story.append(H1("5. Smaller Issues Worth Picking Up"))

story.append(H2("5.1 Config and identity"))
story.append(B("<font face='Courier'>config.ts</font>: <font face='Courier'>anthropic.model = \"claude-opus-4-1\"</font> &mdash; still wrong (current is <font face='Courier'>claude-opus-4-7</font>). Same issue as the prior audit; pushed forward but never fixed. Easier still: delete this field, source from the registry once the registry holds model ids."))
story.append(B("<font face='Courier'>config.ts</font>: <font face='Courier'>process.env.OPENAI_API_KEY || \"\"</font> still in place. Fail-fast assertion at module load remains open."))
story.append(B("<font face='Courier'>app/layout.tsx</font>: <font face='Courier'>metadata.title = \"Create Next App\"</font> &mdash; still the default. One-line fix."))
story.append(B("Geist fonts loaded but <font face='Courier'>globals.css</font> still uses Arial. Either drop the font loading or apply the CSS variable to <font face='Courier'>body</font>."))

story.append(H2("5.2 Client UX"))
story.append(B("<b>No Stop button.</b> Tied to §3.3 AbortSignal &mdash; one component, real value the moment generation gets slow."))
story.append(B("<b>No auto-scroll</b> as new tokens stream in; the visible content can fall off the bottom of the viewport."))
story.append(B("<b><font face='Courier'>loading=true</font> stays true throughout the stream.</b> The \"JARVIS is thinking...\" placeholder shows alongside the streaming reply &mdash; flip to a 'streaming' state once the first token arrives so the placeholder hides."))
story.append(B("<b>Full <font face='Courier'>setMessages([...])</font> on every chunk.</b> Use an updater function (<font face='Courier'>setMessages(prev =&gt; &hellip;)</font>) or move the streaming content into a ref to avoid re-rendering the entire list on every token."))
story.append(B("<b>React key={index}</b> &mdash; still a footgun the moment edit/regenerate exists. Assign a stable id at message creation."))
story.append(B("<b>Enter sends, Shift+Enter does not newline</b> &mdash; <font face='Courier'>&lt;input&gt;</font> instead of <font face='Courier'>&lt;textarea&gt;</font>."))
story.append(B("<b>No request size cap</b> &mdash; the route accepts arbitrarily large message arrays. Bound it to e.g. 50 messages × 4KB each in the Zod schema."))

story.append(H2("5.3 Tests &amp; pre-commit (still open)"))
story.append(B("No <font face='Courier'>vitest</font> or <font face='Courier'>playwright</font> in <font face='Courier'>package.json</font>; no tests on disk."))
story.append(B("No husky / lint-staged / Prettier pre-commit. v3.1 Phase 1 P1 requires this."))
story.append(B("Provider stream is the most subtle code in the repo and has zero unit tests. A mock-OpenAI stream test (yield three deltas + a usage chunk, assert events + final result) is &lt;30 lines."))

story.append(H2("5.4 Docs reconciliation"))
story.append(B("ARCHITECTURE.md still describes the Python/FastAPI/Ollama runtime in &sect;10 and &sect;20. The code says TypeScript/Next is the answer. Edit the architecture (in place, with a 'Stack' subsection at the top) so the two no longer disagree."))
story.append(B("README hasn't been re-read in this audit; the prior audit flagged a Python-narrative mismatch &mdash; check whether streaming/cost/rate-limit setup steps now match the code."))

story.append(PageBreak())

# ---------- Verdict / order ----------
story.append(H1("6. Should Anything Change Before Anthropic Lands?"))

story.append(P("<b>Yes &mdash; two changes, both cheap now.</b>", callout_style))

story.append(H2("6.1 Must-do before Phase 1B"))
must = [
    ["#", "Change", "Why now"],
    ["A", "Change <font face='Courier'>StreamResult.stream</font> from <font face='Courier'>AsyncIterable&lt;string&gt;</font> to <font face='Courier'>AsyncIterable&lt;StreamEvent&gt;</font>. Map OpenAI deltas to <font face='Courier'>{type:'text'}</font> events; emit terminal <font face='Courier'>{type:'usage'}</font> + <font face='Courier'>{type:'done'}</font>.", "Adding Anthropic on top of <font face='Courier'>string</font> means designing the event taxonomy under pressure with two consumers already calcified. Designing it with one is straightforward."],
    ["B", "Switch <font face='Courier'>/api/chat</font> response from <font face='Courier'>text/plain</font> to <font face='Courier'>text/event-stream</font> (SSE). Update client to parse SSE frames.", "Same logic: one client and one route today; two providers worth of mid-stream events tomorrow. text/plain becomes structurally insufficient the moment a tool call or error needs to travel."],
    ["C", "Thread <font face='Courier'>AbortSignal</font> from <font face='Courier'>req.signal</font> through provider.stream(); honour client disconnect.", "Cost leak the moment users abandon long generations. Cheap to add now; touches every provider once it exists."],
    ["D", "Add <font face='Courier'>time_to_first_token_ms</font> to <font face='Courier'>GenerateResult</font> and telemetry.", "v3.1 §7 budgets are first-token; today they're unmeasurable. Trivial to capture from inside the iterator."],
]
story.append(table(must, col_widths=[0.3*inch, 3.5*inch, 2.7*inch]))

story.append(H2("6.2 Nice-to-have but not blocking"))
nice = [
    ["#", "Change", "Why deferrable"],
    ["E", "Replace placeholder cost with per-model token-rate from a registry table.", "Cost guard already gates; absolute precision matters more after a second provider has a different rate sheet."],
    ["F", "Promote telemetry to SQLite with the full v3.1 §17 schema.", "In-memory is fine until sessions exist (which they don't yet)."],
    ["G", "Sentence-chunker scaffold under <font face='Courier'>src/lib/streaming/</font>.", "Not needed until Phase 4 voice; the StreamEvent shape from (A) is the only prerequisite, and that's a separate change."],
    ["H", "Cap conversation history / summarise at N turns.", "Real cost risk, but unrelated to the stream architecture. Defer to a memory pass."],
]
story.append(table(nice, col_widths=[0.3*inch, 3.5*inch, 2.7*inch]))

story.append(H2("6.3 Future-compat scorecard"))
score = [
    ["Future capability", "Compatible with current stream layer?", "If not, what changes"],
    ["Anthropic text streaming", "Partially &mdash; works as bare strings, loses event structure.", "(A) typed events."],
    ["Anthropic tool-use streaming", "No.", "(A) typed events + tool_call event types."],
    ["OpenAI tool_calls streaming", "No &mdash; route only reads <font face='Courier'>delta.content</font>.", "(A) typed events + map <font face='Courier'>delta.tool_calls</font>."],
    ["Sentence chunking for TTS", "No clean home, but possible.", "(A) typed events so the chunker can listen for content-block boundaries."],
    ["TTS streaming dispatch", "No.", "(A) + new streaming module; consumes events, dispatches audio."],
    ["SSE / event multiplexing", "No &mdash; wire is text/plain.", "(B) switch to text/event-stream."],
    ["Client cancel / disconnect", "No.", "(C) thread AbortSignal."],
    ["First-token latency budgets (§7)", "Unmeasured.", "(D) capture in iterator."],
]
story.append(table(score, col_widths=[1.7*inch, 2.1*inch, 2.7*inch]))

# ---------- Closing ----------
story.append(H1("7. Closing"))
story.append(P(
    "The streaming work that landed is good. Provider abstraction is the right idea in the right place. The route "
    "is well-structured (validate &rarr; rate-limit &rarr; cost-gate &rarr; stream &rarr; record). The client "
    "streams correctly and degrades sensibly on error. None of this needs to be undone."
))
story.append(P(
    "What needs doing &mdash; once, this week &mdash; is widening the stream's <i>type</i> and <i>wire format</i> "
    "from one channel to many, before a second provider arrives and locks both choices in. Items A&ndash;D in §6.1 "
    "are the smallest change that makes that happen. Everything else in this audit can wait."
))
story.append(Spacer(1, 12))
story.append(P("&mdash; Audit complete.", subtitle_style))


# ---------- Build ----------
def add_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#888888"))
    canvas_obj.drawString(
        0.75 * inch,
        0.5 * inch,
        "JARVIS Codebase Audit · Streaming Checkpoint · 16 May 2026 · Confidential",
    )
    canvas_obj.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas_obj.restoreState()


doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=letter,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
    topMargin=0.75 * inch,
    bottomMargin=0.85 * inch,
    title="JARVIS Codebase Audit - Streaming Checkpoint (16 May 2026)",
    author="Claude Opus 4.7",
)
doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
print(f"Wrote {OUTPUT}")
