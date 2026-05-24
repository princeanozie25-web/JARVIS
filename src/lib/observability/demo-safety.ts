export type DemoSafetySource = "synthetic";
export type DemoSafetyAuthority = "read_only";
export type DemoSafetyClassification = "metadata_only";

export interface DemoSafetyEnvelope<T> {
  readonly marker: string;
  readonly source: DemoSafetySource;
  readonly live_data_access: false;
  readonly persistence_access: false;
  readonly authority: DemoSafetyAuthority;
  readonly classification: DemoSafetyClassification;
  readonly data: T;
}

export interface DemoSafetyValidation<T> {
  readonly ok: boolean;
  readonly data: T | null;
  readonly errors: readonly string[];
}

export const REQUIRED_DEMO_MARKER = "Synthetic demo-safe metadata";

export function validateDemoSafety<T>(
  envelope: Partial<DemoSafetyEnvelope<T>>,
): DemoSafetyValidation<T> {
  const errors: string[] = [];

  if (envelope.marker !== REQUIRED_DEMO_MARKER) {
    errors.push("missing_demo_marker");
  }
  if (envelope.source !== "synthetic") {
    errors.push("invalid_demo_source");
  }
  if (envelope.live_data_access !== false) {
    errors.push("live_data_access_not_false");
  }
  if (envelope.persistence_access !== false) {
    errors.push("persistence_access_not_false");
  }
  if (envelope.authority !== "read_only") {
    errors.push("invalid_demo_authority");
  }
  if (envelope.classification !== "metadata_only") {
    errors.push("invalid_demo_classification");
  }
  if (!isSafeMetadataValue(envelope.data)) {
    errors.push("unsafe_demo_payload");
  }

  return Object.freeze({
    ok: errors.length === 0,
    data: errors.length === 0 ? clone(envelope.data as T) : null,
    errors: Object.freeze(errors),
  });
}

export function createDemoSafetyEnvelope<T>(data: T): DemoSafetyEnvelope<T> {
  return Object.freeze({
    marker: REQUIRED_DEMO_MARKER,
    source: "synthetic",
    live_data_access: false,
    persistence_access: false,
    authority: "read_only",
    classification: "metadata_only",
    data: clone(data),
  });
}

function isSafeMetadataValue(value: unknown): boolean {
  return !containsUnsafePayload(value, new Set());
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isSecretText(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafePayload(item, seen));
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKeyValue(key, child)) return true;
    if (containsUnsafePayload(child, seen)) return true;
  }
  return false;
}

function isUnsafeKeyValue(key: string, value: unknown): boolean {
  if (
    /raw|payload_json|prompt|output|ocr|frame|voice|transcript|project_body|command_value|secret|token/i.test(
      key,
    )
  ) {
    if (value === null || value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
