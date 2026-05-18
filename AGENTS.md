<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-18 7:25pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (24,294t read) | 2,450,307t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 10:46 AM)

### May 17, 2026

347 1:50p 🟣 fs.create_file Tool Implemented in src/lib/tools/fs-write.ts
348 " 🟣 InProcessToolRuntime Patched for BLOCK Safety and Explicit Approval Enforcement
352 6:22p 🔵 Phase 2 Write-Tool System Architecture Under Audit
353 6:23p 🔵 Phase 2 Audit: All Gates PASS — Safe to Proceed to fs.rename
354 " 🔵 Approval Anti-Replay and Cross-Session Isolation Confirmed Correct
355 " 🔵 Write Tool Rollback System: Every Write Creates a Rollback Record
356 " 🔐 P1: executionId Used Unsanitized in Rollback Backup Path and Temp File Path
357 " 🔵 Tool Surface Area: Exactly 8 Tools Registered, Prohibited Tools Absent
358 " 🔵 Direct fs Reads Outside Tool Modules: All Legitimate Uses Confirmed
359 " 🔵 InProcessToolRuntime: Approval Check Always Runs Before tool.execute()
360 " 🔵 Telemetry and tool_calls Schema: Complete Enough for Full Action Debugging
361 " ⚖️ Next Implementation Step: fs.rename with Atomic Move and fs_move_back Rollback
362 6:25p 🔵 PROVIDER_TOOL_IDS Split Into Three Exported Sets for Selective AI Exposure
363 6:28p 🚨 Path Traversal Security Fix: Sanitize executionId Before Filesystem Interpolation
364 6:35p 🟣 Approval Token Security: CSRF-Protection for Tool Approvals
365 6:36p 🔵 Approval Token Feature Passes All Quality Gates
366 6:44p 🟣 fs.rename Tool Implementation Planned for JARVIS Phase 2
367 6:45p 🟣 fs.rename Tool Fully Implemented in JARVIS Phase 2
368 6:46p 🔴 fs.rename Destination-Exists Error Classification Fixed via ToolDeniedError
369 6:47p 🔵 fs.rename Phase 2 — All Acceptance Gates Pass, 237 Tests Green
370 6:52p 🔵 Jarvis Project Current Build & Test State — All Green
371 " 🔵 Jarvis Tool System Architecture — File Operations with Approval + Rollback
372 " 🔵 Eval Harness Running Against Two Live Models
373 7:02p ⚖️ Rollback Hardening Architecture for Filesystem Mutation Tools
374 7:03p 🟣 Rollback Hardening: Atomic rollback_id Linkage via SQLite Transaction
375 " 🟣 Rollback Persistence Recovery: persistRollbackOrRecover Pattern in fs-write.ts
376 " 🟣 fs.undo Hardened Selection via getLatestAvailableRollbackForSession
377 " 🟣 Rollback Hardening Test Suite: Failure Injection + Linkage + Undo Skip Tests
378 7:15p 🟣 fs.delete_file Tool Implemented with Reversible Trash System
379 " 🟣 CONFIRM_ALWAYS Safety Tier Enforced — Session Approval Blocked for Delete
380 " 🔵 Jarvis Tool Registry Architecture — Phase 2 Filesystem Tool Set
381 " 🟣 Full Test Coverage Added for fs.delete_file Including Rollback, Undo, and Edge Cases
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

Access 2450k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
