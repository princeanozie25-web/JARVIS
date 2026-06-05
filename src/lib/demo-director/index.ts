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
