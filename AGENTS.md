<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-20 5:47am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,625t read) | 1,871,089t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 10:46 AM)

### May 20, 2026

614 4:52a 🔵 Phase 3.75 Streaming Infrastructure Already Fully Implemented
615 " 🟣 SSE Encoder Upgraded to Emit Named Event Fields
616 " 🟣 OpenAI Provider Stream Tests Added
617 " 🔵 StreamEvent Union Extends Beyond Phase 3.75 Spec — Tool-Call Streaming Already Live
618 " 🔵 AbortController Double-Bridging Pattern in /api/chat Route
621 4:53a ✅ Full Test Suite Passes — 605 Tests Across 78 Files
622 4:54a 🔴 OpenAI Test Config Isolation Improved via vi.mock Instead of process.env Mutation
623 " ✅ Production Build Clean — Known Turbopack Warning on workspace.ts
624 " ✅ Phase 3.75 Final Deliverable State
625 4:58a ⚖️ JARVIS Phase 3.75B — Streaming Runtime Safety Audit Initiated
626 4:59a 🔵 JARVIS Streaming Architecture: Single Canonical StreamEvent Type, Dual Streaming Protocols
627 " 🔵 AbortSignal Propagation and First-Token Telemetry: Full Chain Confirmed Clean
628 " 🔴 SSE Parser: Added Event-Name/JSON-Type Cross-Validation to parseSseEvents
629 " 🔵 Phase 3.75B Audit Verdict: PASS — No Architectural Drift, No Prohibited Capabilities
630 5:05a ⚖️ JARVIS Phase 3.75 — Streaming Runtime Modernisation Planned
631 5:06a 🟣 JARVIS Audio Infrastructure Module Created (src/lib/audio/)
632 " 🟣 VoiceControlPanel Component Added — Push-to-Talk Scaffold Only
633 " 🟣 Audio Telemetry API Endpoint Added — /api/audio/telemetry
634 " 🟣 Audio Module Unit Tests Added — 16 Tests All Passing
635 " 🔴 TypeScript Error Fixed in devices.ts — MediaDeviceKind Assignability
636 " 🔴 ESLint react-hooks/refs Violation Fixed in VoiceControlPanel
637 5:13a 🟣 JARVIS Phase 4A-2: Safe Local Audio Capture Layer Initiated
638 5:14a 🟣 New `src/lib/audio/capture.ts` — Core In-Memory Audio Capture Engine
639 " 🟣 Extended Audio Type System with Capture Session Metadata and TransientAudioChunk
640 " 🟣 VoiceControlPanel Wired to Real Audio Capture with Multi-Layer Safety Guards
641 5:22a ⚖️ Phase 3.75 Streaming Runtime Modernisation — Architectural Scope
642 " 🟣 Typed StreamEvent Union Replaces Plain String Stream Shape
643 " 🟣 Chat API Endpoint Migrated from text/plain to Server-Sent Events
644 " 🟣 AbortSignal Threaded Through Entire Stream Path for Client-Side Cancellation
645 " 🟣 First-Token Latency Telemetry Added to Streaming Pipeline
646 5:23a 🟣 LocalAudioCaptureHandle API Replaces Raw MediaStream in VoiceControlPanel
647 " 🟣 New Audio Capture Module with Transient Analyser Buffer (capture.ts + capture.test.ts)
648 " 🔴 TypeScript TS2352 Error Fixed in capture.ts AudioContext Cast
649 " 🟣 AudioSessionState Extended with Capture Session Tracking Fields
650 " 🟣 Audio Telemetry Route Extended with Capture Lifecycle Event Types
651 " 🔵 Full Test Suite and Production Build Pass After Phase 3.75 Audio Changes
652 " 🔵 node_repl Kernel Crashes with EPERM on C:\Users\princ\AppData lstat in This Environment
653 " ✅ Phase 3.75 Git Status — Final File Set
654 5:28a 🔵 JARVIS Phase 4A-3: Voice Capture Audit Scope Defined
655 5:29a 🔵 JARVIS Audio Capture Stack: Safety Invariants Audit Results
656 " 🔴 PTT Race Condition Fixed with AbortSignal on startLocalAudioCapture
657 " 🔴 VoiceControlPanel Session Status Line: Mojibake Middle-Dot Characters Fixed
658 " 🟣 Added AbortSignal Test for PTT Release During In-Flight Capture
659 " 🔵 AppData EPERM Smoke-Test Blocker: Confirmed Local Environment Permission Anomaly
660 " ✅ Phase 4A-3 Final Build & Test Verification: All Green
661 5:32a ⚖️ Phase 3.75 — Streaming Runtime Modernisation Initiated
662 5:33a 🟣 STT Provider Scaffold (src/lib/stt) Created as Disabled Placeholder
663 5:38a ⚖️ Phase 3.75 — Streaming Runtime Modernisation Objective Defined
664 5:39a 🟣 STT Provider Type System Extended with Capabilities and Registry
665 5:46a ⚖️ JARVIS Phase 3.75 — Streaming Runtime Modernisation Plan

Access 1871k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
