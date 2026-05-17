<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-17 7:50am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,155t read) | 2,071,036t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 10:46 AM)
236 9:54p 🔵 Provider Architecture: Typed StreamEvent Taxonomy with AbortSignal Support
237 " 🔵 DB Client: Singleton WAL-Mode SQLite with server-only Guard
238 " 🔵 Telemetry: Dual-Write to In-Memory Store and SQLite with Silent Fallback
239 " 🔵 Config Module: server-only, Throws on Missing API Keys
240 10:05p 🔵 Codebase Architecture and Audit Constraint Review Initiated
241 10:06p 🔄 Runtime/Node Split for Config and DB — server-only Guard Decoupled from CLI
242 10:08p ⚖️ Codebase Audit Prerequisite Established Before Development
243 10:09p 🔵 Jarvis Project Architecture: Multi-Provider AI Chat with SSE Streaming
244 " 🔄 SSE Encoding/Parsing Extracted to Shared src/lib/streaming/sse.ts Module
245 " 🔵 Eval Suite Confirms Both Providers Operational — Cost Delta Notable

### May 17, 2026

264 7:17a 🔵 Codebase Architecture Review and Audit Compliance Initiated
265 " 🔵 Jarvis Router Architecture: Intent Classification and Safety Pipeline
266 " 🟣 Tool Registry Module Scaffolded with Mock Status Tool
267 " 🔴 Fixed Two Test Failures: T0 No-Model Error and Registry Import Isolation
268 " ✅ Router Types and Capability Updated for "tools" Capability Signal
269 " 🔵 Jarvis Eval Harness Benchmarks Two Providers Across Four Task Types
270 7:27a 🔵 JARVIS Project Current Phase: Between Phase 1.5 (complete) and Phase 1B (next)
271 " 🔵 Provider Layer: OpenAI and Anthropic Both Fully Implemented Behind ChatProvider Interface
272 " 🔵 Router Skeleton Shipped: 4-Stage Pipeline (Intent → Safety → Capability → Selection)
273 " 🔵 SQLite Persistence Layer: sessions, messages, telemetry_events, eval_runs, eval_results Tables Live
274 " 🔵 Cost Guard, Rate Limiter, and Model Registry All Operational
275 " 🔵 API Route Gate Order and Frontend Streaming Architecture Confirmed Correct
276 " 🔵 Tool Registry and Eval Framework Scaffolded; Only Mock Tool Registered
277 " 🔵 Master Architecture Roadmap v3.1 Audit Prescribes 14-Step Phase 2 Tool Execution Framework
278 " 🔵 Uncommitted Changes: Router and AGENTS.md Updated in Working Tree
279 " ⚖️ Phase 2 Work Plan Established: Safety Fix → Tool Runtime Scaffold → Tests → Gates
280 7:28a 🔴 P0 Safety Enforcement Fix: CONFIRM_ONCE/CONFIRM_ALWAYS No Longer Block Chat
281 " 🟣 Tool Runtime Scaffold Implemented: InProcessToolRuntime with Zod Validation, Safety Gates, AbortSignal, and Timeout
282 " 🔴 Two TypeScript/Test Bugs Found and Fixed During Tool Runtime Integration
283 7:32a 🔴 Tool Runtime Abort Signal Early-Exit Fixed
284 " 🔄 Registry Tests Typed Against RouterDecision Interface
285 " 🟣 Tool Runtime Scaffold Fully Validated — All Gates Green
286 7:37a 🟣 Phase 2 Tool Audit Tables — Step 1.3 + execution_id Telemetry
287 7:38a 🔵 Pre-existing Jarvis DB Schema Structure at Phase 2 Start
288 " 🟣 Phase 2 Tool Audit Tables + execution_id Telemetry — Fully Implemented
289 " 🔴 idx_telemetry_execution_id Index Ordering Bug — ALTER TABLE Must Precede Index Creation
290 " 🟣 Phase 2 CRUD Tests Added to schema.test.ts — 64 Tests All Pass
291 7:44a 🟣 ToolContext Abort/Timeout Enforcement Implementation Planned
292 7:45a 🟣 InProcessToolRuntime Rebuilt with Full Persistence, Telemetry, and Abort/Timeout Enforcement
293 " 🔴 Fixed `server-only` Import Crash in Tool Runtime Tests
294 " 🟣 Tool Runtime Test Suite Expanded with DB and Telemetry Assertions
295 " 🟣 Five Tool Telemetry Event Types Added to TelemetryEventType Union
296 " 🔵 All Gate Checks Pass After ToolContext Abort/Timeout Implementation
297 7:48a ⚖️ Local-Runtime Guard Added for JARVIS Tools Mode
298 7:49a 🔵 JARVIS Pre-existing Config and Tool Runtime Structure Mapped
299 " 🟣 src/lib/tools/local-guard.ts — Loopback Guard Module Created
300 " 🟣 Config Extended with tools Section; Runtime Integrated with Guard
301 " 🟣 local-guard.test.ts Added — 4 Guard Scenarios Covered
302 " ✅ README and ARCHITECTURE Documented with Tool Runtime Guard
303 " 🔵 All Gates Passed After Local-Guard Implementation

Access 2071k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
