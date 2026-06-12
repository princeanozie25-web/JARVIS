# Enhancement Registry

All post-Phase-20 changes to frozen surfaces enter here before code.
Format: ID | Title | Frozen surface touched | Justification | Status

E-001 | Phase 22 voice extraction to main | 6 Phase 21 UI files (AuditCockpit, RestCommandCenter, liquid-command-center.css, PipelineDiagram, WorkingCockpit, liquid-command-center-data.ts) — voice-state visibility only, display-only, no new affordances | Phase 22 completion requires code on main | COMPLETE
E-002 | Data-driven pipeline stage registry | /audit/pipeline presentation (3 files) | Phase 23 adds Capture→Frames→Transcript→Analysis→Result; camera path adds a second chain; hardcoded const arrays force repeated frozen-file edits | PROPOSED
E-003 | T4 authority tier definition | authority model | T4 exists in social-extraction schema with no documented semantics; define or remove before Phase 23 builds on it | PROPOSED
E-005 | CRLF-fragile frontmatter regex in typography-tokens.test.ts | frozen test file | Regex breaks on fresh Windows checkouts (CRLF); fix regex to be EOL-agnostic, no behavioral change | PROPOSED
E-006 | Rest voice reactor visibility + wake-word copy amendment | tests/orb/render.test.tsx (one copy assertion only) + RestCommandCenter.tsx | Phase 22 idle copy replaces tap-to-enable; reactor visuals display-only; /provider/i purity regex RETAINED byte-identical; zero provider symbols on Rest; TTS provider readout moves to Working | COMPLETE
