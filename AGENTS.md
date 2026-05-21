<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<claude-mem-context>
# Memory Context

# [jarvis] recent context, 2026-05-21 6:27pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (27,653t read) | 2,245,769t work | 99% savings

### May 16, 2026

S9 User asked where the PDF was saved — Claude provided the full file path (May 16, 7:26 AM)
S8 JARVIS codebase audit against ARCHITECTURE.md v3.1 and Claude audit context.md, output as PDF (May 16, 7:26 AM)
S20 Re-run updated JARVIS codebase audit and export as PDF — streaming checkpoint audit for Phase 1B readiness (May 16, 7:31 AM)
S41 JARVIS Phase 3.75 STT layer modernisation — TranscriptionProviderStatus refactor, LocalWhisperRuntime class, and committing the changes (May 16, 10:46 AM)

### May 21, 2026

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
805 7:16a ✅ Phase 4G Voice Streaming Changes Committed to Repository
806 7:23a 🟣 JARVIS Phase 4D: Live Assistant Response Stream Metadata Ingestion and Chunk Scheduling Scaffold
807 7:24a 🟣 VoiceCloudBudgetGuard: Metadata-Only Cloud Budget Evaluation with Multi-Window Enforcement
808 " 🟣 Budget Guard Type System: VoiceCloudBudget\* Interfaces Added to types.ts and telemetry/types.ts
809 " 🟣 VoiceCloudBudgetGuard Tests: 10 Cases Including Telemetry Safety and No-Wiring Assertions
810 " 🔴 TypeScript Error: Array.push() Return Type Incompatible with void | Promise&lt;void&gt; Telemetry Callback
811 " ✅ Build Status: 860 Tests Pass, Build Clean, Pre-existing NFT Warning Remains
812 7:28a 🟣 JARVIS Phase 4D: Live Assistant Response Stream Metadata Ingestion & Chunk Scheduling Scaffold
813 7:29a 🔵 JARVIS Voice Streaming Module Architecture: Existing Phase 4D–4G Scaffold
814 " 🟣 Phase 4G: VoiceCloudConsentPolicy — Multi-Layer Disclosure Guard for Cloud Voice Routing
815 " 🟣 Phase 4G Consent Policy Test Suite: Metadata Safety, Disclosure Waterfall, and No-Wiring Verification
816 " ✅ All Checks Green: 870 Tests, Clean TypeScript, Clean Lint, Successful Next.js Build
817 7:30a 🔵 Phase 4G Consent Policy Changes Committed — Clean Working Tree for Next Implementation
818 7:36a 🟣 JARVIS Phase 4D: Stream Metadata Ingestion and Chunk Scheduling Scaffold
819 7:37a 🔴 Vitest Set vs ArrayContaining Matcher Incompatibility Fixed
820 " 🟣 Phase 4G Cloud Routing Policy Freeze — Complete and Frozen
821 " 🔵 JARVIS Full Test Suite: 874 Tests Passing After Phase 4G Freeze
822 7:43a 🟣 JARVIS Phase 4D: Voice Stream Metadata Ingestion & Chunk Scheduling Scaffold
823 7:44a 🔵 JARVIS Voice Streaming Module: Full Type Surface and Phase Status (4D–4G)
824 " 🟣 Phase 4H: VoicePrivacyPolicy — Metadata-Only Voice Data Classification and Deny-by-Default Guard
825 " 🔴 Test Regex False Positive: "synthesized_audio" String Literal Matched Forbidden Wiring Regex
826 " ✅ Phase 4H Full Validation: 884 Tests Pass, TypeScript Clean, Lint Clean, Build Succeeds
827 7:51a 🟣 JARVIS Phase 4D: Voice Stream Metadata Ingestion & Chunk Scheduling Scaffold
828 7:52a 🔵 JARVIS Voice Streaming: Full Module Inventory and Telemetry Architecture Pre-Phase-4D-Slice
829 " 🟣 Voice Telemetry Hygiene Module: Centralized Sanitization for All Voice-Streaming Emitters
830 " 🟣 Voice Telemetry Hygiene: 7-Test Suite Covering Allowlist, Strip, Redaction, Stress, and No-Wiring Invariants
831 " 🔴 TypeScript Error: sanitizeVoiceTelemetryEvent Parameter Type Widened from Record to object
832 " 🔴 pipeline.test.ts Freeze Test Failed: approval Regex Matched emitMetadataOnlyVoiceTelemetry in barge-in-coordinator.ts
833 " ✅ Final Test Count After Phase 4D Telemetry Hygiene Slice: 891 Tests Passing (Up from 737)
837 6:17p ⚖️ Phase 5 W1 Scope Defined: Project Identity & Registry Layer for JARVIS
838 6:19p 🔵 JARVIS Pre-existing Project State vs. New Project Registry — Two Separate Tables
839 " 🟣 Phase 5 W1: projects Table, Domain Models, and DB Layer Implemented
840 6:23p ⚖️ Phase 5 W1: Project Identity & Registry — Architecture Constraints Defined
841 6:24p 🟣 Phase 5 W1: Project Tool Layer Implemented — project.list and project.get Live
842 " 🟣 Phase 5 W1: SQLite Migration 014_project_registry Added with CHECK Constraints
843 " 🟣 Phase 5 W1: Project Domain Models and DB Access Layer Created
844 " 🟣 Phase 5 W1: Full Test Suite Added — 33 New Tests Across 4 New Test Files, All 907 Tests Pass
S44 Phase 5 W1: Project Identity & Registry + Project State Schema — implement read-only project registry layer for JARVIS (May 21, 6:26 PM)
**Investigated**: The JARVIS repo's existing tool registry pattern, DB schema migration chain (13 prior migrations), db module barrel export structure (index.ts/node.ts split), existing project_state table (pre-existing, unrelated), tool reversibility/safety tag conventions, and approval architecture constraints. Ripgrep audits confirmed no disabled Phase 5 tool IDs appear in live registration code paths.

**Learned**: JARVIS uses a migration ID array in schema.ts with a single SCHEMA_SQL string; new tables are appended in order. The tool registry pattern separates tool definitions (individual files) from registration (tools/index.ts barrel). Public DB exports are intentionally split between index.ts (browser-safe) and node.ts (Node.js). insertRegisteredProject was removed from both public barrel exports to restrict write surface — it remains directly importable for internal tests only. The projectFromRow mapper always sets indexedAt: null since indexing is out of scope, giving callers a clean signal. SQLite CHECK constraints enforce root_kind and status enums as a defense-in-depth layer below Zod validation.

**Completed**: - Migration 014_project_registry added to src/lib/db/schema.ts with CHECK constraints on root_kind (fs/memory/obsidian/virtual) and status (active/paused/archived), plus two covering indexes. - src/lib/db/projects.ts created: insertRegisteredProject, listRegisteredProjects, getRegisteredProject backed by better-sqlite3 prepared statements. - src/lib/projects/ module created: types.ts (ProjectRow, Project, ProjectRootKind, ProjectStatus, ProjectRegistrationDraft), registry.ts (projectFromRow, createProjectRegistrationDraft, validateProjectRootKind, validateProjectStatus, projectRegistryAuthorityNote), index.ts barrel. - src/lib/tools/projects.ts created: projectListTool (PURE_READ/ALLOW), projectGetTool (PURE_READ/ALLOW), projectRegisterToolScaffold (REVERSIBLE_WRITE/CONFIRM_ALWAYS — always returns DENIED, not registered live). - src/lib/tools/index.ts updated: projectReadTools registered via loop; all project tool symbols and types exported. - src/lib/db/index.ts and node.ts updated: getRegisteredProject and listRegisteredProjects exported; insertRegisteredProject intentionally withheld. - 4 test files added/updated: db/projects.test.ts, projects/registry.test.ts, tools/projects.test.ts, db/schema.test.ts, tools/registry.test.ts. - All gates passed: lint (eslint exit 0), typecheck (tsc --noEmit exit 0), tests (121 files, 907 tests, all passed), build (next build exit 0, 22 routes including /api/projects). - Disabled feature audit confirmed: project.register, project.index, project.write_memory, background.indexing, task.auto_promote, voice.project_mutation are all absent from the live tool registry.

**Next Steps**: Phase 5 W1 is complete and verified. The session has stopped as instructed — no continuation into Phase 5 W2 (indexing), 5C, or any other phase. Next phase would be Phase 5 W2 (project indexer) when ready, which will require extending approval architecture before wiring project.register live.

Access 2246k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
