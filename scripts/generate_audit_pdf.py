"""Generate the JARVIS v3.1 codebase audit as a PDF."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
    KeepTogether,
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
critical_style = ParagraphStyle(
    "Critical",
    parent=body,
    backColor=colors.HexColor("#fdecea"),
    borderColor=colors.HexColor("#d93025"),
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
    return Paragraph("•&nbsp;&nbsp;" + text, bullet)


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

story.append(P("JARVIS Codebase Audit", title_style))
story.append(P(
    "Audit baseline: ARCHITECTURE.md v3.1 (14 May 2026)  &nbsp;|&nbsp;  "
    "Audit date: 16 May 2026  &nbsp;|&nbsp;  "
    "Auditor: Claude Opus 4.7  &nbsp;|&nbsp;  "
    "Repo: jarvis @ main (afb35f2)",
    subtitle_style,
))

# Executive summary
story.append(H1("Executive Summary"))
story.append(P(
    "Phase 1A is technically running &mdash; typed input reaches OpenAI and a reply renders. "
    "Against the v3.1 architecture, however, the current code is a thin chat scaffold, not Phase 1A of JARVIS. "
    "The non-negotiable Phase 0 prerequisites (cost guard, telemetry, prompt versioning, provider abstraction) "
    "are missing, the runtime stack (Next.js/TypeScript) diverges from the architecture's stated stack (Python/FastAPI), "
    "and a critical secret-handling issue requires immediate action."
))
story.append(P(
    "<b>One action this hour:</b> Rotate both API keys. They were transmitted to this audit in plain text. "
    "Even if they were never git-committed, they have left the local boundary."
))
story.append(P(
    "<b>Verdict:</b> Do <i>not</i> add the Anthropic provider on top of the current shape. "
    "Land the Phase 0 prerequisites (cost guard, telemetry, provider interface, streaming, request validation) first &mdash; "
    "what this audit calls Phase 1.5. Adding Anthropic to today's code locks in the abstraction debt and makes "
    "Phase 1C (registry) and Phase 1D (router) significantly harder."
))

# Critical finding box
story.append(H1("Finding #1 &mdash; CRITICAL: Exposed API Keys"))
story.append(P(
    "<b>What:</b> The contents of <font face='Courier'>.env.local</font> &mdash; including both the OpenAI "
    "<font face='Courier'>sk-proj-&hellip;</font> key and the Anthropic <font face='Courier'>sk-ant-&hellip;</font> "
    "key &mdash; were included verbatim in the audit context I was given. "
    "<font face='Courier'>.gitignore</font> covers <font face='Courier'>.env*</font>, so likely not committed, "
    "but the keys have nonetheless left their original boundary.",
    critical_style,
))
story.append(P("<b>Immediate actions (do these before continuing the audit response):</b>"))
story.append(B("Revoke the OpenAI key at <font face='Courier'>platform.openai.com/api-keys</font> and issue a new one."))
story.append(B("Revoke the Anthropic key at <font face='Courier'>console.anthropic.com/settings/keys</font> and issue a new one."))
story.append(B("Review OpenAI and Anthropic usage logs for any calls you don't recognise."))
story.append(B("Verify <font face='Courier'>git log --all -p -- .env.local</font> shows no history (it should not, given <font face='Courier'>.gitignore</font>, but verify)."))
story.append(B("Going forward, never paste <font face='Courier'>.env*</font> contents into prompts. Provide the file <i>path</i> and let the tool read it."))
story.append(Spacer(1, 6))
story.append(P(
    "<b>Also note:</b> <font face='Courier'>process.env.OPENAI_API_KEY || \"\"</font> in "
    "<font face='Courier'>src/lib/config.ts</font> silently accepts an empty key. "
    "Replace with a fail-fast assertion at module load so a missing key crashes the boot instead of producing "
    "confusing 401s at runtime."
))

story.append(PageBreak())

# Alignment matrix
story.append(H1("1. Alignment Matrix &mdash; v3.1 vs Repo"))
data = [
    ["Architecture requirement (v3.1)", "Repo state", "Status"],
    ["Cost cap module (Phase 0, P0)", "Absent. No daily/weekly/monthly caps. No budget check on /api/chat.", "MISSING"],
    ["Telemetry / observability", "console.error only. No SQLite events table, no cost log, no latency log.", "MISSING"],
    ["Prompt versioning under prompts/", "prompts/.gitkeep only. No system prompt loaded into any call.", "MISSING"],
    ["Provider abstraction", "Single function generateOpenAIResponse called directly from route.", "INSUFFICIENT"],
    ["Model registry (YAML, source of truth)", "Hardcoded in src/lib/config.ts. No tier metadata, no capabilities, no swap path.", "MISSING"],
    ["Router (intent / safety / capability / cost)", "None. POST handler does not classify, does not gate, does not select.", "MISSING"],
    ["Streaming by default", "openai.ts uses non-streaming chat.completions.create. Route returns one JSON blob.", "MISSING"],
    ["Safety gates / confirmation flow", "None. No destructive actions yet, but no scaffolding either.", "MISSING (acceptable now, must precede tools)"],
    ["State is explicit / bounded persistence", "Chat history in client useState only. Lost on refresh. Unbounded growth in payload.", "BROKEN"],
    ["Repo structure (apps/, core/, models/, tools/, &hellip;)", "Next.js app structure. No core/, no models/providers/, no tools/.", "DIVERGED (intentional? unclear)"],
    ["Stack: Python + FastAPI + Ollama", "Next.js 16 + React 19 + TypeScript + openai SDK.", "CONTRADICTION (README still claims Python)"],
    ["Pre-commit hooks + test framework (Phase 1 P1)", "No tests, no hooks, no husky, no vitest, no playwright.", "MISSING"],
    ["AGENTS.md: 'NOT the Next.js you know'", "No evidence node_modules/next/dist/docs/ was consulted. Route uses generic patterns.", "UNVERIFIED"],
]
story.append(table(data, col_widths=[2.4*inch, 2.7*inch, 1.4*inch]))

story.append(PageBreak())

# Section 2: Security
story.append(H1("2. Security Issues"))

story.append(H2("2.1 Secret handling (see Finding #1)"))
story.append(B("Keys exposed via paste &mdash; rotate now."))
story.append(B(
    "<font face='Courier'>config.ts</font> uses <font face='Courier'>process.env.OPENAI_API_KEY || \"\"</font>. "
    "Fail fast instead: throw at load if key missing."
))
story.append(B(
    "README setup instructions reference <font face='Courier'>.env</font>; the repo actually uses "
    "<font face='Courier'>.env.local</font>. Both are gitignored, but the mismatched convention is the kind of "
    "thing that produces an accidental commit when a future contributor names theirs <font face='Courier'>.env.production</font>."
))

story.append(H2("2.2 Unbounded request &amp; cost-drain surface"))
story.append(B(
    "<b>No rate limiting on /api/chat.</b> Anyone who reaches localhost (or your eventual deployed URL) can hit the route "
    "in a tight loop. Combined with no cost cap, this is unbounded spend exposure."
))
story.append(B(
    "<b>No request size limit.</b> <font face='Courier'>body.messages</font> is accepted as-is. A 200KB payload of crafted "
    "messages becomes input tokens on every send."
))
story.append(B(
    "<b>No origin / CORS check.</b> Next.js route handlers accept POSTs from any origin by default. Browser CORS protects "
    "from cross-site fetch but does not protect from a hostile page issuing <font face='Courier'>fetch(&hellip;)</font> as "
    "no-cors or from non-browser clients."
))
story.append(B(
    "<b>No authentication.</b> Local dev is fine, but the architecture (§2.5) requires safety gates as core, not future. "
    "Without an auth layer, the safety classifier has nothing to gate against. Add a session token now &mdash; even a "
    "single-user shared secret &mdash; before deploying anywhere."
))

story.append(H2("2.3 Input validation &amp; injection"))
story.append(B(
    "<b>No runtime validation.</b> <font face='Courier'>const body: ChatRequest = await req.json()</font> is a TypeScript "
    "cast, not a check. Malformed input reaches the OpenAI SDK and produces opaque 500s. Use Zod or Valibot."
))
story.append(B(
    "<b>No prompt-injection defence.</b> User content is appended verbatim to the message array. There is no system "
    "message instructing the model to ignore embedded instructions, and no allow-list of tool calls. Acceptable today "
    "(no tools exist), but the day you wire Phase 2 desktop tools, an unguarded prompt injection becomes a "
    "code-execution path."
))

story.append(H2("2.4 Error disclosure"))
story.append(B(
    "Route catches all errors and returns the literal string \"Something went wrong.\" That's good (no stack leak), but "
    "(a) the client renders that string as a normal assistant message, which destroys trust in the output, and (b) you "
    "lose the ability to distinguish auth failures, validation failures, rate-limit hits, and upstream 5xxs at the UI layer."
))

story.append(PageBreak())

# Section 3: Architecture
story.append(H1("3. Architecture Weaknesses vs v3.1"))

story.append(H2("3.1 Phase 0 prerequisites unmet"))
story.append(P(
    "v3.1 §16 is explicit: <i>\"Cost caps implemented before Phase 1A closes. The orchestrator refuses requests that would "
    "breach caps. Non-negotiable.\"</i> Phase 1A is currently running cloud calls with no cap, no telemetry, no router. "
    "By the architecture's own standard, Phase 1A is not actually closed."
))

story.append(H2("3.2 Stack vs architecture contradiction"))
story.append(P(
    "The architecture (§10 Repository Structure, §20 Hardware Reality Check) and the README both describe a "
    "Python runtime &mdash; <font face='Courier'>jarvis.py</font>, FastAPI under <font face='Courier'>apps/api/</font>, Ollama "
    "in-process, SQLite, pytest. The actual repo is a Next.js 16 web app with the OpenAI Node SDK. These are not the "
    "same system. Two paths forward:"
))
story.append(B(
    "<b>Path A &mdash; Web is the runtime, architecture follows.</b> Rewrite the architecture's repo layout and stack table "
    "to reflect a TypeScript-first stack: <font face='Courier'>core/</font> becomes <font face='Courier'>src/core/</font>, "
    "Ollama is called over HTTP from Next, telemetry uses better-sqlite3 or libsql, voice runs via WebSpeech / Web Audio. "
    "Lose the Electron desktop assumption; keep the principles."
))
story.append(B(
    "<b>Path B &mdash; Python is the runtime, web is a UI.</b> Keep the Python core as planned; this Next app becomes "
    "<font face='Courier'>apps/dashboard/</font> talking to a local FastAPI server. The current chat endpoint moves "
    "to a Python service; the Next route becomes a thin proxy."
))
story.append(P(
    "Either is defensible. <b>Neither is the current state.</b> Decide before Phase 1B so the provider abstraction is built "
    "in the right language."
))

story.append(H2("3.3 No system prompt"))
story.append(P(
    "Messages are sent to OpenAI as-is. There is no JARVIS persona, no safety preamble, no tool-use frame, no token "
    "ceiling. Architecture §18.1 requires prompts to live under <font face='Courier'>prompts/</font> with hash-logged "
    "loading per call. Today, <font face='Courier'>prompts/jarvis_system.md</font> does not exist."
))

story.append(H2("3.4 No router"))
story.append(P(
    "Every request &mdash; \"hi\", \"turn off the light\", \"review this 4kloc repo\" &mdash; routes to the same "
    "<font face='Courier'>gpt-4o-mini</font> call. Architecture §4 specifies a four-stage router. None of it exists. "
    "Adding it after a second provider is significantly harder than adding it before."
))

story.append(H2("3.5 Unbounded conversation history"))
story.append(P(
    "Every send re-uploads the entire <font face='Courier'>messages</font> array. By turn 50 your input tokens dominate "
    "your bill. v3.1 §15 mandates a memory compression layer; v3.1 §8.1 expects sentence-streamed responses. "
    "Neither exists. This is the single biggest cost-runaway risk in the current code."
))

story.append(H2("3.6 Wrong Anthropic model id"))
story.append(P(
    "<font face='Courier'>config.ts</font> sets <font face='Courier'>anthropic.model = \"claude-opus-4-1\"</font>. "
    "The current latest is <font face='Courier'>claude-opus-4-7</font> (per the runtime model info this session). "
    "Architecture §5 example uses <font face='Courier'>claude-opus-4-6</font>. Trivial fix, but a symptom of the "
    "deeper issue: model identifiers should live in a registry, not hardcoded in <font face='Courier'>config.ts</font>."
))

story.append(PageBreak())

# Section 4: TS/Next mistakes
story.append(H1("4. TypeScript &amp; Next.js Mistakes"))

story.append(H2("4.1 tsconfig path mapping"))
story.append(P(
    "Current: <font face='Courier'>\"@/*\": [\"./*\"]</font>. This makes the import "
    "<font face='Courier'>@/src/lib/openai</font> rather than the conventional <font face='Courier'>@/lib/openai</font>. "
    "Either map <font face='Courier'>@/*</font> to <font face='Courier'>./src/*</font>, or introduce a second alias "
    "<font face='Courier'>~/*</font>. Decide before the import graph grows."
))

story.append(H2("4.2 Leftover scaffolding"))
story.append(B("<font face='Courier'>app/layout.tsx</font>: <font face='Courier'>metadata.title = \"Create Next App\"</font>. Replace with \"JARVIS\"."))
story.append(B("<font face='Courier'>app/layout.tsx</font> loads Geist via <font face='Courier'>next/font/google</font> and sets CSS variables, but <font face='Courier'>app/globals.css</font> uses <font face='Courier'>font-family: Arial, Helvetica, sans-serif</font>. Geist is downloaded but never applied."))
story.append(B("<font face='Courier'>globals.css</font> defines light/dark CSS variables, but <font face='Courier'>app/page.tsx</font> hardcodes <font face='Courier'>bg-black text-white</font>. Either drop the variables or use them."))
story.append(B("<font face='Courier'>app/favicon.ico</font> is still the Next.js default."))

story.append(H2("4.3 API route"))
story.append(B(
    "Type cast without validation: <font face='Courier'>const body: ChatRequest = await req.json()</font>. Use Zod."
))
story.append(B(
    "No explicit runtime/dynamic directives. Recommended: "
    "<font face='Courier'>export const runtime = 'nodejs';</font> "
    "<font face='Courier'>export const dynamic = 'force-dynamic';</font> &mdash; the OpenAI SDK requires Node runtime "
    "and explicit dynamic prevents Next from attempting any caching of the POST."
))
story.append(B(
    "Generic catch-all error: distinguish auth (401), validation (400), upstream timeout (504), rate-limit (429)."
))

story.append(H2("4.4 Client page (app/page.tsx)"))
story.append(B("No <font face='Courier'>try/catch</font> around <font face='Courier'>fetch</font>. A network drop produces an unhandled rejection."))
story.append(B("On 500, route returns <font face='Courier'>{message: 'Something went wrong.'}</font>; client renders that as an assistant message. Check <font face='Courier'>res.ok</font> first, render an error state instead."))
story.append(B("Input and Send button are not disabled while <font face='Courier'>loading=true</font>. Spam-send is possible."))
story.append(B("No <font face='Courier'>AbortController</font>; user cannot cancel a slow request."))
story.append(B("React <font face='Courier'>key={index}</font>. Acceptable today; will break the moment you add edit/regenerate. Assign stable IDs at message creation."))
story.append(B("No auto-scroll to bottom on new message."))
story.append(B("Enter sends but Shift+Enter does not newline (single-line <font face='Courier'>&lt;input&gt;</font> instead of textarea)."))
story.append(B("No empty-state or loading skeleton; the page can flash before <font face='Courier'>useState</font> initialises."))

story.append(H2("4.5 Tooling gaps"))
story.append(B("<font face='Courier'>target: \"ES2017\"</font> in tsconfig is from an old template. Next 16 + React 19 + Node 20 can safely use <font face='Courier'>ES2022</font>."))
story.append(B("No <font face='Courier'>engines</font> field in package.json; Node version isn't pinned."))
story.append(B("No Prettier, no Husky, no lint-staged, no pre-commit hook. v3.1 Phase 1 P1 explicitly requires this."))
story.append(B("<font face='Courier'>\"lint\": \"eslint\"</font> with no path. <font face='Courier'>\"eslint .\"</font> is clearer and matches CI expectations."))
story.append(B("No test runner (vitest), no Playwright skeleton."))

story.append(PageBreak())

# Section 5: Scalability
story.append(H1("5. Scalability Problems"))
story.append(B(
    "<b>Conversation re-upload.</b> Every send re-transmits the full history. Linear cost growth per turn, quadratic "
    "across a session. Needs (a) Anthropic prompt-caching when that provider lands, and (b) a memory compression layer "
    "(v3.1 §15) that summarises old turns."
))
story.append(B(
    "<b>No persistence.</b> Chat history lives in React state. Refresh = data loss. SQLite session table from §17 "
    "telemetry schema solves this."
))
story.append(B(
    "<b>No streaming.</b> The client waits for the full response before rendering. At T3 latency targets (§7, ~1.5s "
    "P95) this is tolerable; at T4 frontier (3s P95, 6s ceiling) the UI will look frozen."
))
story.append(B(
    "<b>No concurrency control.</b> If you open two tabs and send simultaneously, both hit the route, both bill, neither "
    "knows about the other. No queue, no dedupe, no idempotency key."
))
story.append(B(
    "<b>No caching.</b> Identical questions cost the same as fresh ones. v3.1 §16 calls for caching repeated results."
))

# Section 6: Provider abstraction
story.append(H1("6. Is the Provider Abstraction Ready for Anthropic?"))
story.append(P("<b>Short answer:</b> No. Adding Anthropic on top of the current shape would calcify the wrong abstraction."))
story.append(P("<b>Current shape:</b>"))
story.append(CODE(
    "// src/lib/openai.ts\n"
    "export async function generateOpenAIResponse(messages: Message[]) {\n"
    "  const response = await openai.chat.completions.create({\n"
    "    model: config.openai.model,\n"
    "    messages,\n"
    "  });\n"
    "  return response.choices[0]?.message?.content ?? 'No response generated.';\n"
    "}\n\n"
    "// app/api/chat/route.ts\n"
    "const response = await generateOpenAIResponse(body.messages);"
))
story.append(P(
    "The route knows the provider's name. The function name encodes it. Adding "
    "<font face='Courier'>generateAnthropicResponse</font> means the route grows a switch statement. That switch grows "
    "again at Ollama. By the time Phase 1C registry lands, the route has three branches and a config flag."
))
story.append(P("<b>What 'good enough' looks like before Anthropic lands:</b>"))
story.append(CODE(
    "// src/lib/providers/types.ts\n"
    "export interface GenerateOptions {\n"
    "  model: string;\n"
    "  systemPrompt?: string;\n"
    "  maxTokens?: number;\n"
    "  temperature?: number;\n"
    "}\n"
    "export interface GenerateResult {\n"
    "  content: string;\n"
    "  inputTokens: number;\n"
    "  outputTokens: number;\n"
    "  costUsd: number;\n"
    "  latencyMs: number;\n"
    "}\n"
    "export interface ChatProvider {\n"
    "  readonly id: string;            // 'openai' | 'anthropic' | 'ollama'\n"
    "  generate(messages: Message[], opts: GenerateOptions): Promise&lt;GenerateResult&gt;;\n"
    "  stream(messages: Message[], opts: GenerateOptions): AsyncIterable&lt;string&gt;;\n"
    "}\n\n"
    "// src/lib/providers/openai.ts     implements ChatProvider\n"
    "// src/lib/providers/anthropic.ts  implements ChatProvider\n"
    "// src/lib/providers/index.ts      registry: id -&gt; ChatProvider"
))
story.append(P(
    "The route then becomes: <font face='Courier'>const provider = registry.get(modelId); const result = await provider.generate(messages, opts);</font> "
    "Cost is reported by the provider, not the route. Streaming is uniform. Telemetry has one place to fire."
))

story.append(PageBreak())

# Section 7: Fix list before Phase 1.5
story.append(H1("7. Fix List Before Phase 1.5"))
story.append(P(
    "Phase 1.5 = \"the bridge from a chat scaffold to something that earns the name JARVIS\". It is not in v3.1 explicitly; "
    "I'm proposing it as a hard gate before Phase 1B (provider wrappers) starts."
))

story.append(H2("P0 &mdash; Blockers (this week)"))
p0 = [
    ["#", "Fix", "Why"],
    ["1", "Rotate exposed API keys", "Finding #1"],
    ["2", "Implement cost guard module (hard daily/weekly/monthly caps, orchestrator-enforced)", "v3.1 §16, P0 in §24"],
    ["3", "Zod validation on /api/chat request body", "Security 2.3"],
    ["4", "Rate limit /api/chat (in-memory bucket is fine for now)", "Security 2.2"],
    ["5", "Fix client error path: read res.ok, render error state, do not render error JSON as assistant message", "TS/Next 4.4"],
    ["6", "Throw at boot if API keys missing (no silent empty string)", "Security 2.1"],
    ["7", "Add prompts/jarvis_system.md and load on every call; log prompt hash", "v3.1 §18.1"],
]
story.append(table(p0, col_widths=[0.3*inch, 3.7*inch, 2.5*inch]))

story.append(H2("P1 &mdash; Architectural prerequisites for Phase 1B"))
p1 = [
    ["#", "Fix", "Why"],
    ["8", "Decide stack: Path A (TS-first) or Path B (Python core + Next UI). Update ARCHITECTURE.md to match.", "Section 3.2"],
    ["9", "Define ChatProvider interface in src/lib/providers/types.ts", "Section 6"],
    ["10", "Refactor openai.ts to implement ChatProvider", "Section 6"],
    ["11", "Add streaming: ReadableStream from route, SSE or NDJSON to client", "v3.1 §8"],
    ["12", "Add SQLite telemetry (better-sqlite3 or libsql) with the v3.1 §17 events schema", "v3.1 §17"],
    ["13", "Add registry.ts (or .yaml + loader). Replace hardcoded model strings in config.ts.", "v3.1 §5"],
    ["14", "Fix Anthropic model id (→ claude-opus-4-7 or the registry-current id)", "Section 3.6"],
    ["15", "Cap conversation length OR add first-pass summarisation at N=20 turns", "Section 5 / v3.1 §15"],
    ["16", "Persist sessions to SQLite, not React useState", "v3.1 §9"],
    ["17", "Fix tsconfig path mapping (@/* → ./src/*)", "TS/Next 4.1"],
]
story.append(table(p1, col_widths=[0.3*inch, 3.7*inch, 2.5*inch]))

story.append(H2("P2 &mdash; Polish before 1B is merged"))
p2 = [
    ["#", "Fix", "Why"],
    ["18", "Husky + lint-staged + Prettier pre-commit hook", "v3.1 Phase 1 P1"],
    ["19", "Vitest skeleton + 3 unit tests (provider stub, validation, cost calc)", "v3.1 §18"],
    ["20", "Playwright smoke test: send a message, assert reply renders", "v3.1 §18"],
    ["21", "Reconcile README: drop Python-only narrative or move it to docs/aspirational/", "Section 3.2"],
    ["22", "Replace 'Create Next App' metadata, Geist font wiring, color inconsistencies", "TS/Next 4.2"],
    ["23", "Add engines.node to package.json; upgrade tsconfig target to ES2022", "TS/Next 4.5"],
    ["24", "Wire AGENTS.md rule: confirm each Next.js change was checked against node_modules/next/dist/docs/", "AGENTS.md"],
]
story.append(table(p2, col_widths=[0.3*inch, 3.7*inch, 2.5*inch]))

story.append(PageBreak())

# Section 8: Roadmap order
story.append(H1("8. Does the v3.1 Roadmap Order Still Make Sense?"))
story.append(P(
    "Mostly yes, with two friction points that the current code surfaces."
))

story.append(H2("8.1 Phase 0 is not actually done"))
story.append(P(
    "The roadmap treats Phase 0 as in-progress and Phase 1A as complete. The audit finds the opposite: 1A's user-visible "
    "behaviour works, but 1A's <i>structural</i> exit criteria (cost caps enforce themselves; tests run; pre-commit hook "
    "exists) are missing. The bar for 'phase complete' should include the structural criteria, not just the demo. "
    "Recommendation: re-open Phase 0 + 1A; close them together with the P0/P1 fix list above."
))

story.append(H2("8.2 Phase 1B before any more UI features"))
story.append(P(
    "Every feature added to the current chat UI before the provider interface lands becomes a thing you have to re-test "
    "against three providers. Freeze UI work above the API line until the abstraction is in."
))

story.append(H2("8.3 Phase 2 has a stack problem"))
story.append(P(
    "Phase 2 is \"local desktop tools\" (open folders, launch apps, file ops). A Next.js web app cannot do this from the "
    "browser. v3.1 §10 implies an Electron desktop shell (<font face='Courier'>apps/desktop/</font>); the current "
    "repo has no such shell. Phase 2 will require either: (a) an Electron wrapper, (b) a local FastAPI/Node sidecar the "
    "web app calls, or (c) a CLI runtime that the web UI proxies to. <b>Pick this before Phase 2 starts</b>, ideally as "
    "part of the stack decision in P1 item #8."
))

story.append(H2("8.4 Phase 4 voice depends on Phase 2 tools"))
story.append(P(
    "Voice without a tool surface is a transcription toy. The roadmap already orders 2 before 4 &mdash; correct. Just "
    "confirming this audit doesn't suggest swapping them."
))

story.append(H2("8.5 Suggested revised early order"))
revised = [
    ["Phase", "Capability", "Status after this audit"],
    ["0", "Foundations + cost caps + tests + pre-commit + Docker", "RE-OPEN. P0/P1 items 1–7."],
    ["1A", "Typed core loop", "RE-OPEN. Close jointly with 0."],
    ["1.5", "Provider interface, streaming, telemetry, registry skeleton, persistence", "NEW. P1 items 8–17."],
    ["1B", "Anthropic + Ollama providers behind the interface", "Unblocked by 1.5."],
    ["1C", "Registry calibration suite", "As planned."],
    ["1D", "Router (intent / safety / capability / cost)", "As planned."],
    ["Stack-decision gate", "Resolve web-vs-desktop before Phase 2", "NEW. Output of P1 item 8."],
    ["2", "Local tools (via the chosen runtime)", "As planned, contingent on gate."],
    ["3–9", "As v3.1", "Order unchanged."],
]
story.append(table(revised, col_widths=[1.2*inch, 3.0*inch, 2.3*inch]))

# Closing
story.append(H1("9. Closing Notes"))
story.append(P(
    "The code that exists is clean and readable for what it is: a 200-line Next chat. The gap between it and v3.1 is "
    "not about code quality; it's about scope. v3.1 describes an orchestration system with a chat UI on top. The repo "
    "today is a chat UI with no orchestration underneath. The fix list above is the smallest set of changes that turns "
    "one into the other without cutting any planned capability."
))
story.append(P(
    "<b>Three things to do today:</b> (1) rotate the keys, (2) decide Path A or Path B for the stack, "
    "(3) start the cost guard module. Everything else in the P0/P1 list follows from those three."
))
story.append(Spacer(1, 12))
story.append(P("&mdash; Audit complete.", subtitle_style))


# ---------- Build ----------
def add_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#888888"))
    canvas_obj.drawString(0.75 * inch, 0.5 * inch, "JARVIS Codebase Audit  ·  16 May 2026  ·  Confidential")
    canvas_obj.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas_obj.restoreState()


doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=letter,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
    topMargin=0.75 * inch,
    bottomMargin=0.85 * inch,
    title="JARVIS Codebase Audit (16 May 2026)",
    author="Claude Opus 4.7",
)
doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
print(f"Wrote {OUTPUT}")
