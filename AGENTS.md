<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-19 7:19am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,064t read) | 1,892,465t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 10:46 AM)

### May 17, 2026

378 7:15p 🟣 fs.delete_file Tool Implemented with Reversible Trash System
382 7:19p ⚖️ Phase 2 Post-Delete Safety Audit Scope Defined
383 7:20p 🔵 fs.delete_file Safety Architecture: Full Code-Path Audit Results
384 " 🔵 Phase 2 CI Gates: All Pass — lint, tsc, build, test (255/255), eval (0 failures)
385 7:24p 🟣 fs.delete_file Hostile Execution ID Tests Added
386 " 🟣 fs.delete_file Telemetry Correlation and Anthropic Adapter Tests Added
387 " 🔵 Jarvis Project Architecture and Current Build State
388 7:25p 🔵 Complete Jarvis Tool Registry and Rollback System Architecture
389 " 🔵 Rollback Visibility Layer and API Routes Architecture
390 " 🔵 Planned But Unimplemented Tool IDs Referenced in Tests

### May 18, 2026

425 6:42p 🔵 Full Quality Gate Re-Run: All Checks Passed
426 " 🔵 Jarvis Tool Architecture: Provider ID Sets, Reversibility Classes, Approval Tokens
427 6:48p 🔵 Approval DB Layer: Token Hashing, Lifecycle States, Session vs Once Grants
428 " 🔵 Rollback DB Layer: Atomic Rollback-ToolCall Linking via Transaction
429 " 🔵 terminal.run / network.fetch / browser Tools Confirmed Non-Existent
430 " 🔵 Scope Hash Privacy: File Content Never Stored Raw in scope_hash
431 6:50p ✅ Phase 2 Close: Phase 5+ Placeholder Files Created
433 7:09p ⚖️ JARVIS Phase 3A Scope Defined: Vault Foundation + Memory Schema
434 7:22p 🟣 JARVIS Phase 3A: Vault Foundation + Memory Schema Initiated
435 7:25p ⚖️ JARVIS Phase 3B.1 Scope: Manual Keyword Memory Retrieval Foundation
436 7:47p ⚖️ JARVIS Phase 3A Scope Boundary Established
437 " 🟣 JARVIS Phase 3A: Vault Scaffold + Memory Schema Plan
438 7:48p 🟣 JARVIS memory.recall Tool Implemented with SQLite FTS5
439 " 🟣 SQLite FTS5 Memory Index Added as Migration 005
440 " 🟣 Memory Inspector Panel Upgraded with Filterable Search Controls
441 " 🔴 Test Order Mismatch Fixed in registry.test.ts and tool-continuation.test.ts
442 " 🟣 memory.recall Integration Tests Added
443 " 🔵 JARVIS Phase 3A Already Fully Implemented Before This Session
444 7:56p ⚖️ JARVIS Phase 3A Scope Defined: Vault Foundation + Memory Schema
445 " 🟣 memory.note Tool Registered via Phase 2 Tool Contract
446 " 🟣 SQLite Memory Schema: Four New Tables for JARVIS Phase 3A
447 7:57p 🔵 JARVIS Memory Infrastructure Pre-Existed Before Phase 3A Session
448 " 🟣 Embedding Infrastructure Added: Config, Providers, and Orchestration Layer
449 " 🟣 SQLite Embedding DB Functions and Telemetry Event Added
450 " 🟣 Embedding Tests: 15 Tests Across Config, Providers, and Orchestration
451 " ✅ Full CI Gate Passes: 33/33 Tests, TSC Clean, ESLint Clean, Next.js Build Succeeds
452 8:02p 🟣 JARVIS Phase 3B.3: Vector Store Integration Initiated
453 " 🟣 JARVIS Phase 3B.3: Vector Store Layer Implemented and All Checks Passing
454 " 🔴 Vector Sync Test: Non-Deterministic SQLite Insert Order Fixed
455 11:45p 🟣 JARVIS Phase 3C.1: Session Summary Schema and Storage Foundation
456 11:46p 🟣 JARVIS Phase 3C.1 Implemented: session_summaries Table, CRUD Helpers, and Telemetry
457 " ⚖️ session_summaries Self-Referential FK Requires Column Order Discipline in SQLite DDL

### May 19, 2026

459 7:12a ⚖️ Phase 3D Readiness Audit Initiated for JARVIS Memory System
460 7:14a 🔵 JARVIS Working Tree Not Clean — Four Uncommitted Changes Found
461 7:15a 🔵 Phase 3C Last Commit Confirmed — 28 Files, 2473 Insertions
462 " 🔵 Phase 3C Context NOT Injected into Live Chat Prompts
463 " 🔵 Memory Candidate Accept/Edit Buttons Confirmed Hard-Disabled in UI
464 " 🔵 memory.recall Enforces Sensitivity Ceiling at DB Query Level
465 " 🔵 project_state API is GET-Only — No Write Endpoint Exists
466 " 🔵 Build/Lint/TypeScript Pass; One Test Failure Caused by Deleted PDF Artifact

Access 1892k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
