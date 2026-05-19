export {
  consentManifestPathFromEnv,
  createDefaultConsentManifest,
  readConsentManifest,
  requireConsent,
  setConsentFromUserAction,
} from "./manifest";
export {
  getConsentRevocationVersion,
  processConsentRevocation,
  recordConsentRevocationBlockedProjection,
  registerConsentRevocationInvalidator,
  REVOCATION_MANAGED_FEATURE_IDS,
} from "./revocation";
export type { ConsentManifestOptions, SetConsentInput } from "./manifest";
export type { RevocationManagedFeatureId } from "./revocation";
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
