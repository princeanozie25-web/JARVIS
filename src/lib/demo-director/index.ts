export {
  DEMO_ASSEMBLY_STAGES,
  DEMO_AUDIENCES,
  DEMO_CUE_KINDS,
  DEMO_PLAYBACK_STATES,
  DEMO_PROPOSAL_STATUSES,
  DEMO_SEGMENT_KINDS,
  type DemoAssemblyStage,
  type DemoAudience,
  type DemoCue,
  type DemoCueKind,
  type DemoPlaybackSnapshot,
  type DemoPlaybackState,
  type DemoProposal,
  type DemoProposalInbox,
  type DemoProposalStatus,
  type DemoScript,
  type DemoSegment,
  type DemoSegmentKind,
} from "./contracts";

export {
  DemoAudienceSchema,
  DemoCueKindSchema,
  DemoCueSchema,
  DemoProposalSchema,
  DemoProposalStatusSchema,
  DemoScriptSchema,
  DemoSegmentKindSchema,
  DemoSegmentSchema,
  parseDemoProposal,
  parseDemoScript,
  parseDemoSegment,
  sumSegmentDurations,
  tryParseDemoScript,
} from "./schemas";

export {
  DEMO_SCRIPTS,
  DEMO_SCRIPT_GENERAL,
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
  DEMO_SCRIPT_TECHNICAL,
  loadDemoScript,
  type DemoScriptName,
} from "./fixtures";

export {
  EMPTY_DEMO_PROPOSAL_INBOX,
  appendToInbox,
  approveProposal,
  denyProposal,
  findProposal,
  isPlaybackEligible,
  proposeDemo,
  type ProposeDemoInput,
} from "./proposal";

export {
  ASSEMBLY_BEATS,
  ASSEMBLY_CLIMAX_STAGE,
  ASSEMBLY_DURATION_MS,
  ASSEMBLY_STAGE_ORDER,
  assemblyStageAt,
  type AssemblyBeat,
} from "./assembly-sequence";

export {
  CUE_ACTIVATION_WINDOW_MS,
  playbackSnapshot,
  playbackTimeline,
} from "./playback";

export {
  DEMO_NARRATION_PROVIDER_IDS,
  buildNarrationLines,
  createExistingLocalFallbackNarrationProvider,
  defaultDemoNarrationProviders,
  prepareDemoNarration,
  selectNarrationProvider,
  type DemoNarrationAudioCue,
  type DemoNarrationLine,
  type NarrationTelemetryOptions,
  type DemoNarrationProvider,
  type DemoNarrationProviderHealth,
  type DemoNarrationProviderId,
  type DemoNarrationTrack,
} from "./narration";

export {
  NARRATION_FAILOVER_REASONS,
  NARRATION_TELEMETRY_FORBIDDEN_FIELDS,
  createNarrationFailoverTelemetrySink,
  findForbiddenTelemetryField,
  type NarrationFailoverInfo,
  type NarrationFailoverReason,
  type NarrationFailoverTelemetrySinkDeps,
  type NarrationProviderSelectedInfo,
  type NarrationTelemetrySink,
} from "./failover-telemetry";

export {
  DEFAULT_PIPER_FALLBACK_CONFIG_PATH,
  PIPER_FALLBACK_PROVIDER_ID,
  createPiperNarrationFallbackProvider,
  loadPiperFallbackConfig,
  type PiperFallbackConfigResult,
  type PiperFallbackResolvedConfig,
  type PiperNarrationFallbackOptions,
} from "./piper-fallback";

export {
  DEMO_RECORDING_TARGETS,
  assertRecordingPlanSafe,
  createDemoRecordingPlan,
  type DemoRecordingFrame,
  type DemoRecordingManifest,
  type DemoRecordingPlan,
  type DemoRecordingTarget,
} from "./recording";

export {
  createPipelineDemoDirectorCloseout,
  type DemoDirectorCloseout,
} from "./closeout";
