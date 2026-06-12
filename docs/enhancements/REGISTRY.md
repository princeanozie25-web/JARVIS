# Enhancement Registry

All post-Phase-20 changes to frozen surfaces enter here before code.
Format: ID | Title | Frozen surface touched | Justification | Status

E-001 | Phase 22 voice extraction to main | 6 Phase 21 UI files (AuditCockpit, RestCommandCenter, liquid-command-center.css, PipelineDiagram, WorkingCockpit, liquid-command-center-data.ts) — voice-state visibility only, display-only, no new affordances | Phase 22 completion requires code on main | COMPLETE
E-002 | Data-driven pipeline stage registry | /audit/pipeline presentation (3 files) | Phase 23 adds Capture→Frames→Transcript→Analysis→Result; camera path adds a second chain; hardcoded const arrays force repeated frozen-file edits — RESOLVED as visibility lanes (spec §23B): spine byte-frozen, lanes data-driven in lane-registry.ts, PipelineDiagram refactored once | COMPLETE
E-003 | T4 authority tier definition | authority model | T4 exists in social-extraction schema with no documented semantics; define or remove before Phase 23 builds on it | PROPOSED
E-005 | CRLF-fragile frontmatter regex in typography-tokens.test.ts | frozen test file | Regex breaks on fresh Windows checkouts (CRLF); fix regex to be EOL-agnostic, no behavioral change | PROPOSED
E-006 | Rest voice reactor visibility + wake-word copy amendment | tests/orb/render.test.tsx (one copy assertion only) + RestCommandCenter.tsx | Phase 22 idle copy replaces tap-to-enable; reactor visuals display-only; /provider/i purity regex RETAINED byte-identical; zero provider symbols on Rest; TTS provider readout moves to Working | COMPLETE
E-008 | Phase 13 registry-pin reshape | frozen test files tests/models/registry.test.ts, phase-13a-closeout.test.ts, phase-13b-closeout.test.ts, resolver.test.ts; additive provider-kind "google" in src/models/types.ts + schema.ts | Deep-equal ID censuses froze the catalog as data, contradicting 23A T4 doctrine + 21A living-catalog premise; reshaped to baseline-preservation + universal schema assertions; google added as a cloud-only provider kind for the disabled catalog entries | APPROVED
E-009 | Fixture-ize resolver tests | decouple tests/models/resolver.test.ts from live config/models/registry.yaml | behavioral tests should run against fixture registries | PROPOSED
