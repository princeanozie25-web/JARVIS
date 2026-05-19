export {
  consentManifestPathFromEnv,
  createDefaultConsentManifest,
  readConsentManifest,
  requireConsent,
  setConsentFromUserAction,
} from "./manifest";
export type { ConsentManifestOptions, SetConsentInput } from "./manifest";
export {
  PHASE_3D_FEATURE_IDS,
  PHASE_3D_FEATURE_LABELS,
  PHASE_3D_FEATURE_SCOPES,
} from "./types";
export type {
  ConsentFeatureId,
  ConsentGateBlocked,
  ConsentGateAllowed,
  ConsentGateResult,
  ConsentManifest,
  ConsentRecord,
} from "./types";
