<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-17 7:27am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,074t read) | 1,782,978t work | 99% savings

### May 16, 2026

43 7:25a 🚨 JARVIS Audit: Critical — Both API Keys Exposed in Audit Context
44 " 🔵 JARVIS Repo State vs v3.1 Architecture: Major Structural Gaps Found
45 " 🟣 JARVIS Audit PDF Generated via ReportLab Python Script
46 " ⚖️ Audit Recommends Phase 1.5 Gate Before Adding Anthropic Provider
S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
89 10:36a 🔵 Audit Context File Has Pending Changes
90 " 🔵 Jarvis Project Audit Scope: Streaming Architecture Review
91 " 🔵 Jarvis Architecture v3.1: Comprehensive 574-Line Master Roadmap
92 " 🔵 Current Jarvis Implementation Is Next.js, Not Python Backend
93 10:37a 🔵 Provider Abstraction: ChatProvider Interface Is Future-Compatible
94 " 🔵 Route Streaming: ReadableStream/text-plain Works but Lacks SSE Structure
95 " 🔵 Telemetry Is In-Memory Only — Lost on Every Server Restart
96 10:38a 🔵 Significant Implementation Progress Since Prior Audit — All P0 Items Addressed
97 " 🔵 Cost Guard Is Implemented But Uses Placeholder USD — Caps Are Not Truly Enforced
98 " 🔵 Prior Audit PDF Script Reveals v3.1 Gap Analysis: Most P0 Items Now Resolved
99 " 🔵 .gitignore Confirmed: .env\* Pattern Covers All Env Files
100 10:46a ✅ JARVIS Audit PDF Generator Updated to Streaming Checkpoint Version
101 " 🟣 JARVIS Streaming Checkpoint Audit PDF Generated Successfully
102 " 🔵 JARVIS Audit PDF Confirmed at 23KB; DOCX Also Exists in docs/
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 10:46 AM)
118 3:07p ⚖️ Safe Fallback for Unknown Model Pricing Instead of Hard Throw
230 9:52p 🔵 Jarvis Codebase Scan — AGENTS.md Modified
231 9:53p 🔵 Jarvis Full Project Structure and Tech Stack
232 " 🔵 Eval Framework: Types, Cases, Runner, and Storage
233 " 🔵 SQLite Schema: Five Tables Covering Sessions, Messages, Telemetry, and Evals
234 " 🔵 All Quality Gates Pass: 30 Tests, Clean Lint, Zero TS Errors, Successful Build
235 " ✅ AGENTS.md Memory Context Refreshed: Timestamp and Minor Cleanup
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

Access 1783k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
