<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-20 8:04pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,630t read) | 1,814,780t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)

### May 20, 2026

655 5:29a 🔵 JARVIS Audio Capture Stack: Safety Invariants Audit Results
656 " 🔴 PTT Race Condition Fixed with AbortSignal on startLocalAudioCapture
657 " 🔴 VoiceControlPanel Session Status Line: Mojibake Middle-Dot Characters Fixed
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

Access 1815k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
