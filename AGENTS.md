<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-20 7:54pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,469t read) | 2,140,298t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)

### May 20, 2026

641 5:22a ⚖️ Phase 3.75 Streaming Runtime Modernisation — Architectural Scope
642 " 🟣 Typed StreamEvent Union Replaces Plain String Stream Shape
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
666 5:47a 🔄 JARVIS STT TranscriptionProviderStatus Type Expansion
667 " 🟣 LocalWhisperRuntime Class with Lifecycle, Timeout, and AbortSignal
668 " 🔄 VoiceControlPanel STT Imports Split to Sub-Module Paths
669 " 🔵 JARVIS Full Test Suite and Build Passing After STT Refactor
S41 JARVIS Phase 3.75 STT layer modernisation — TranscriptionProviderStatus refactor, LocalWhisperRuntime class, and committing the changes (May 20, 5:48 AM)
670 5:51a ⚖️ Phase 3.75 — Streaming Runtime Modernisation Planned for JARVIS
671 6:21p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Initiated
672 6:23p 🟣 VoiceControlPanel Wired to Real Transcription Job and Draft Managers
673 " 🟣 New manual-voice-flow.ts Guard Module for Local STT Readiness
674 " 🟣 Cancellation-Safety Test Added to InMemoryTranscriptionJobManager
675 " 🔵 Phase 3.75 Streaming Changes Not Yet Started — Session Implemented Voice Panel STT Integration Instead
676 6:31p ⚖️ JARVIS Phase 4B-13: Manual Local STT Flow Audit Initiated
677 7:15p ⚖️ Phase 3.75 — Streaming Runtime Modernisation Scoped and Initiated
678 7:16p 🔵 JARVIS Pre-Phase-3.75 Codebase Survey: Existing STT and Voice Infrastructure
679 " 🔄 VoiceControlPanel: cancelActiveTranscription Extracted to useCallback
680 7:17p 🔵 Phase 3.75 Pre-Implementation State: VoiceControlPanel Refactor Committed, Codebase Clean
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

Access 2140k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
