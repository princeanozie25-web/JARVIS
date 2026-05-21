<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-21 7:16am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (29,014t read) | 1,607,097t work | 98% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)

### May 20, 2026

S41 JARVIS Phase 3.75 STT layer modernisation — TranscriptionProviderStatus refactor, LocalWhisperRuntime class, and committing the changes (May 20, 5:48 AM)
755 11:23p 🔵 JARVIS Phase 4D Voice Streaming Pipeline Already Fully Implemented
756 " 🟣 JARVIS Phase 4E.1: Metadata-Only Barge-In Coordinator Implemented
757 " 🟣 Barge-In Coordinator Test Suite Added with Safety Assertion Coverage
758 11:28p 🔵 JARVIS Phase 4D Voice Streaming — Current State Before Metadata Ingestion Slice
759 " 🟣 JARVIS Phase 4D — Stream Metadata Ingestion and Chunk Scheduling Scaffold Planned
760 11:29p 🟣 JARVIS Phase 4E — VoiceBargeInCoordinator Rewritten With Internal State Machine
761 " 🟣 JARVIS Phase 4E — Barge-In Coordinator State Machine Tests Including In-Flight Concurrency
762 " 🟣 JARVIS Phase 4E — All CI Gates Pass: 788 Tests, Clean TypeScript, Lint, and Build
763 11:32p 🟣 JARVIS Phase 4D: Live Assistant Response Stream Metadata Ingestion & Chunk Scheduling Scaffold
764 11:33p 🟣 Phase 4E: Turn Preemption Records Added to VoiceBargeInCoordinator
765 " 🟣 Phase 4E Turn Preemption: All Validation Gates Pass — 789 Tests, Clean Lint, Clean Build
766 11:36p 🟣 Phase 4E: Capture Rearm Intent/Result Types and Telemetry Events Added to types.ts
767 " 🟣 Phase 4E: Capture Rearm Lifecycle Implemented in VoiceBargeInCoordinator
768 11:40p 🟣 JARVIS Phase 4D: Stream Metadata Ingestion and Chunk Scheduling Scaffold
769 " 🟣 JARVIS Phase 4E: Capture Re-arm Coordination Added to VoiceBargeInCoordinator
770 11:45p 🟣 JARVIS Phase 4D: Stream Metadata Ingestion and Chunk Scheduling Scaffold
771 " 🟣 VoiceBargeInCoordinator: In-Flight Terminal Transition Guard
772 " 🔵 JARVIS voice-streaming types.ts: Full Type Surface as of Phase 4E
773 11:49p 🟣 JARVIS Phase 4D: Live Assistant Response Stream Metadata Ingestion and Chunk Scheduling Scaffold
774 11:51p 🟣 Phase 4E VoiceBargeInCoordinator Test Suite Expanded with Coverage, Failure, and Telemetry-Safety Tests
775 " 🔴 Safety Wiring Test False Positive: `canAutoplay` Field in types.ts Matched Autoplay Regex
776 " 🔴 TypeScript Error: Array.includes on Narrow Tuple Against Full Union Type
777 " ✅ Phase 4E Frozen and Phase 4F Handoff Documented in voice-streaming README
778 " 🔵 JARVIS Test Suite Grew from 737 to 795 Tests After Phase 4E Barge-In Coordinator Additions
779 11:54p 🟣 JARVIS Phase 4D: Stream Metadata Ingestion and Chunk Scheduling Scaffold Planned
780 11:55p 🟣 JARVIS Phase 4F: VoiceRuntimeBoundaryCoordinator Implemented
781 " 🔴 Wiring-Safety Test Regex Collisions Fixed After Phase 4F Types Addition
782 " 🔵 Phase 4F Final Validation: 801 Tests Pass, TypeScript Clean, Lint Clean, Build Succeeds
783 11:56p 🟣 Phase 4F Voice Approval Refusal Model Extended with Categorized Attempt Types

### May 21, 2026

784 12:01a 🟣 JARVIS Phase 4D: Stream Metadata Ingestion & Chunk Scheduling Scaffold
785 12:02a 🟣 Voice Approval Refusal Records & Categorized Rejection in Runtime Boundary Coordinator
786 " 🟣 Voice Approval Refusal Test Suite Expanded with Parameterized Category Coverage
787 " 🔵 JARVIS Phase 4D Build Verification: 808 Tests Pass, Clean TypeScript & Lint, Pre-existing Turbopack Warning
788 12:10a 🟣 JARVIS Phase 4D: Voice Stream Metadata Ingestion & Chunk Scheduling Scaffold
789 12:11a 🔵 JARVIS Voice Streaming Module: Existing Phase 4D–4F Implementation Before New Work
790 " 🟣 Phase 4F Extension: VoiceRestrictedContentBoundary — Metadata-Only Content Classification
791 " 🟣 VoiceRestrictedContentBoundary Test Suite: 12 Tests Covering Safety Invariants
792 12:14a 🟣 JARVIS Phase 4D: Stream Metadata Ingestion and Chunk Scheduling Scaffold
793 12:15a 🟣 VoiceRuntimeBoundaryCoordinator Rebuilt with Lifecycle State Machine, Operation Deduplication, Ordering Detection, and Stale-Session Rejection
794 " 🔴 Test Fixture State Value Mismatches Fixed After Coordinator Rewrite
795 " 🟣 Full Test Suite Passes After Phase 4F Coordinator Upgrade: 825 Tests Across 110 Files
796 12:16a 🔵 Pre-existing Turbopack NFT Warning in Production Build from workspace.ts Dynamic Path Usage
797 " ✅ Phase 4F Coordinator Work Staged and Ready: 445 Insertions Across 7 Files
798 12:20a 🔵 AGENTS.md Has Both Staged and Unstaged Changes After Session
799 7:08a 🟣 JARVIS Phase 4G.1 — Cloud Voice Routing Policy Scaffold Initiated
800 7:14a 🟣 JARVIS Phase 4D: Live Assistant Response Stream Metadata Ingestion & Chunk Scheduling Scaffold
801 7:15a 🔵 JARVIS Phase 4D Stream Metadata Ingestion Already Fully Implemented Prior to This Session
802 " 🟣 Phase 4G: VoiceCloudRoutingPolicy — Disabled-by-Default Metadata-Only Cloud Routing Gate
803 " 🟣 Phase 4G Tests: cloud-routing-policy.test.ts with Telemetry Safety and Anti-Wiring Freeze Assertions
804 " 🟣 Phase 4G README Documentation and Test Suite Growth from 737 to 848

Access 1607k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
