<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-20 9:40pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,315t read) | 1,119,821t work | 98% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)

### May 20, 2026

S41 JARVIS Phase 3.75 STT layer modernisation — TranscriptionProviderStatus refactor, LocalWhisperRuntime class, and committing the changes (May 20, 5:48 AM)
703 8:01p 🟣 LocalTtsRuntime Class Added to JARVIS TTS Layer
705 8:03p ⚖️ JARVIS Phase 3.75 — Streaming Runtime Modernisation Plan Established
706 8:04p 🔵 JARVIS Pre-Phase-3.75 Baseline: 97 Test Files, 686 Tests All Passing
707 " 🔵 Uncommitted TTS Stub Work Pre-Exists Phase 3.75 Start
708 8:08p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Initiated
709 " 🔵 JARVIS TTS Layer Pre-Flight Audit — Infrastructure Confirmed Clean
710 " 🔴 Added Missing Voice-Model-Missing Test Case to LocalTtsRuntime
711 8:14p ⚖️ JARVIS Phase 4C-5: TTS Sentence Chunker Audit Scope Defined
712 8:15p 🔵 JARVIS TTS Module Architecture: Types, Safety Policy, and StreamEvent Integration
713 " 🟣 TtsSentenceChunker Implemented: Streaming Text-to-Speech Sentence Chunker
714 " 🔴 findTerminalBoundary Replaced with findFlushBoundary to Correctly Enforce minChunkChars
715 " 🟣 TtsSentenceChunker Test Suite: 9 Tests Covering All Audit Checklist Items
716 " ✅ Phase 4C-5 Audit Complete: All Checks Green, No Synthesis or Playback Wiring Added
717 8:17p 🔵 TtsSentenceChunker Confirmed Isolated: No Wiring to App, Components, or Chat Pipeline
718 " 🟣 Two Additional Hardening Tests Added: Split Deltas and Sticky Block State
719 8:34p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Scoped
720 " 🟣 TtsSentenceChunker Implemented for Phase 4C-4 TTS Pipeline
721 " 🟣 Phase 4C-4 Verification: 698 Tests Passing, TypeScript Clean, Build Clean
722 8:35p 🔵 STT InMemoryTranscriptionJobManager Used as Architectural Pattern for TTS Queue
723 " 🟣 SpeechQueue Types Added to TTS Type System
724 8:47p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Scoped and Assigned
725 " 🟣 InMemorySpeechQueueManager Implemented with Safety Gating and Telemetry
726 " 🔵 Phase 3.75 Streaming Tasks Not Yet Started — TTS Queue Work Done Instead
727 8:57p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Initiated for JARVIS
728 8:58p 🔵 JARVIS TTS Queue Scaffold Exists with Safety Policy Integration
729 " 🔵 TelemetryEvent Schema Already Has time_to_first_token_ms Field
730 " 🔵 Full JARVIS Test Suite at 706 Tests All Passing; Build Succeeds with One Pre-existing Warning
731 9:04p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Plan
732 9:05p 🔵 TTS Queue Scaffold Already Exists and Is Well-Structured Pre-Phase-3.75
733 " 🔵 time_to_first_token_ms Already Present in TelemetryEvent Schema
734 " 🟣 TTS Queue Test Extended With Error Sanitization Coverage
735 " 🔵 Known Build Warning: NFT Tracing Spans Whole Project via runtime-commands/workspace.ts
736 9:07p ⚖️ JARVIS Phase 3.75 — Streaming Runtime Modernisation Scoped
737 " 🔵 JARVIS TTS Layer — Existing Infrastructure Mapped
738 " 🟣 TTS Type System Extended with SpeechAudioResult and AbortSignal Support
739 " 🟣 LocalTtsSynthesisHandle Interface Added to local-runtime.ts
740 " 🟣 New local-synthesis-provider.ts — Full Local TTS Synthesis Execution Layer
741 " 🟣 InMemorySpeechQueueManager Gets markReady() Transition
742 " ✅ Telemetry Type Union Extended with Three Local TTS Synthesis Events
743 9:09p 🟣 local-synthesis-provider.test.ts — 8-Case Test Suite Added
744 " 🔴 Null-Handle Test Broken by ?? Operator — Fixed to Strict undefined Check
745 9:10p ✅ TypeScript Full Project Type-Check Passes After Phase 3.75 TTS Changes
746 " ✅ Phase 3.75 TTS Layer — Full Verification Passed: 714 Tests, Clean Lint, Clean Build
747 9:15p ⚖️ JARVIS Phase 4C-9: Local TTS Synthesis Audit Initiated
748 9:16p 🔵 JARVIS TTS Local Synthesis Provider: Full Safety Architecture Confirmed
749 " 🔵 JARVIS TTS Local Runtime: Metadata Invariants Enforced at Both Runtime and Provider Layers
750 " 🔵 JARVIS TTS Queue: No Audio Data Storage, Complete Error Sanitization, Transcript Tag Blocking
751 " 🔵 JARVIS TTS Safety Policy: Whitelist-Only Speech Sources with Pattern-Based Content Blocking
752 " 🔵 JARVIS Telemetry Types: TTS Events Added to Global Registry, No Text or Audio Fields in Base Event
753 " 🟣 Phase 4C-9 Hardening: Two New Tests Added to local-synthesis-provider.test.ts

Access 1120k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
