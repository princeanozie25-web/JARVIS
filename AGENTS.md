<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-20 9:03pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,295t read) | 1,312,450t work | 98% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)

### May 20, 2026

S41 JARVIS Phase 3.75 STT layer modernisation — TranscriptionProviderStatus refactor, LocalWhisperRuntime class, and committing the changes (May 20, 5:48 AM)
681 7:18p 🔵 VoiceControlPanel Refactor Committed; Only AGENTS.md Remains Staged
682 7:31p ⚖️ Phase 4B-13: Manual Local STT Flow Audit Scoped
683 7:32p 🔵 Phase 4B-13 Audit: Manual Local STT Flow Verified Clean — No P0/P1 Issues Found
684 " 🔵 STT Pre-flight Gate: `getManualTranscriptionStartBlockReason` Enforces Four Hard Stops
685 " 🔵 Audio Snapshot Pattern: Transient Chunks Cloned Before `capture.stop()` Is Awaited
686 " 🔵 Local Whisper Runtime Enforces `assertLocalOnly` at Both Initialize and Transcribe Call Sites
687 " 🔵 Transcript Draft Pipeline: `canApproveRuntimeActions: false` Hardcoded End-to-End
688 " 🔵 InMemoryTranscriptionJobManager: Double-Guard with `isCancelled` Check After Async Transcription
689 7:35p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Planned for JARVIS
690 7:36p 🔵 JARVIS src/lib Directory Structure Mapped
691 " 🟣 TTS Scaffold Module Created at src/lib/tts/
692 " ✅ VoiceControlPanel Speaker Section Updated to Show TTS Provider State
693 " 🔵 JARVIS Full Test Suite at 96 Files / 679 Tests All Passing
694 7:55p 🔵 JARVIS Phase 4C-1: TTS Scaffold Audit Initiated
695 7:56p 🔵 JARVIS TTS Types: Full Type System Confirmed Safe
696 7:57p 🔵 JARVIS TTS Providers: Disabled and Local Placeholder Confirmed Safe
697 " 🔵 JARVIS TTS Registry: Default Provider is "disabled", Unknown Lookup Throws
698 " 🔵 JARVIS TTS Safety Policy: Multi-Layer Block Logic Confirmed
699 " 🔵 JARVIS VoiceControlPanel Speaker Panel: TTS Disabled State Rendered Correctly
700 " 🟣 TTS Safety Policy Tests Hardened: Two New personal_context Block Cases Added
701 " 🔵 JARVIS Phase 4C-1 TTS Audit: All Checks Pass, No Prohibited Paths Found
702 8:00p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Planned for JARVIS
703 8:01p 🟣 LocalTtsRuntime Class Added to JARVIS TTS Layer
704 " 🔵 TTS Layer Was Pre-Phase-4 Stub With No Runtime Lifecycle
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

Access 1312k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
