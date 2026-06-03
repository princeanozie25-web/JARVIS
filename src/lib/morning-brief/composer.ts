import { z } from "zod";
import {
  MorningBriefInputReadinessSchema,
  MorningBriefRealInputSchema,
  buildMorningBriefInputReadiness,
  type MorningBriefInputReadiness,
  type MorningBriefRealInput,
} from "./real-input-contract";

export const MORNING_BRIEF_COMPOSER_VERSION =
  "phase21c.morning-brief-composer.v1" as const;

export const MORNING_BRIEF_COMPOSITION_STATUSES = [
  "composed",
  "degraded",
  "failed_closed",
] as const;

export const MORNING_BRIEF_COMPOSED_SECTION_TYPES = [
  "gmail",
  "calendar",
  "drive",
  "jarvis_status",
  "agent_preview",
] as const;

export const MORNING_BRIEF_COMPOSER_GOVERNANCE = {
  read_only: true,
  input_driven: true,
  deterministic: true,
  preview_only: true,
  metadata_governed: true,
  live_google_calls_supported: false,
  scheduler_supported: false,
  delivery_supported: false,
  suggestion_inbox_write_supported: false,
  model_call_supported: false,
  network_call_supported: false,
  filesystem_write_supported: false,
  database_write_supported: false,
  approval_execution_supported: false,
  mutation_supported: false,
  new_authority_surface_added: false,
  metadata_only: true,
} as const;

const DEFAULT_COMPOSER_OPTIONS = {
  generated_at: null,
  title: null,
  max_items_per_section: 8,
  include_optional_empty_sections: false,
} as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const BoundedTextSchema = z.string().trim().min(1).max(500);

const ItemMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

export const MorningBriefCompositionStatusSchema = z.enum(
  MORNING_BRIEF_COMPOSITION_STATUSES,
);

export const MorningBriefComposedSectionTypeSchema = z.enum(
  MORNING_BRIEF_COMPOSED_SECTION_TYPES,
);

export const MorningBriefComposerOptionsSchema = z.strictObject({
  generated_at: IsoDateTimeSchema.nullable().default(null),
  title: BoundedTextSchema.nullable().default(null),
  max_items_per_section: z.number().int().min(1).max(20).default(8),
  include_optional_empty_sections: z.boolean().default(false),
});

export const MorningBriefComposerInputSchema = z.strictObject({
  real_input: MorningBriefRealInputSchema,
  options: MorningBriefComposerOptionsSchema.default(DEFAULT_COMPOSER_OPTIONS),
});

export const MorningBriefItemSchema = z.strictObject({
  item_id: z.string().trim().min(1).max(260),
  source: MorningBriefComposedSectionTypeSchema,
  title: BoundedTextSchema,
  summary: BoundedTextSchema,
  metadata_flags: z.array(z.string().trim().min(1).max(120)).default([]),
  source_ref: z.string().trim().min(1).max(260),
  metadata: z.record(z.string(), ItemMetadataValueSchema).default({}),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefComposedSectionSchema = z.strictObject({
  section_type: MorningBriefComposedSectionTypeSchema,
  title: BoundedTextSchema,
  status: z.enum(["present", "degraded", "optional", "missing"]),
  item_count: z.number().int().nonnegative(),
  summary: BoundedTextSchema,
  items: z.array(MorningBriefItemSchema),
  metadata: z.record(z.string(), ItemMetadataValueSchema).default({}),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefGovernanceSummarySchema = z.strictObject({
  read_only: z.literal(true),
  input_driven: z.literal(true),
  deterministic: z.literal(true),
  preview_only: z.literal(true),
  metadata_governed: z.literal(true),
  live_google_calls_attempted: z.literal(false),
  scheduler_invoked: z.literal(false),
  delivery_attempted: z.literal(false),
  suggestion_inbox_write_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
  approval_execution_attempted: z.literal(false),
  mutation_attempted: z.literal(false),
  new_authority_surface_added: z.literal(false),
  metadata_only: z.literal(true),
});

export const MorningBriefSchema = z.strictObject({
  kind: z.literal("morning_brief.composed"),
  composer_version: z.literal(MORNING_BRIEF_COMPOSER_VERSION),
  title: BoundedTextSchema,
  composed_at: IsoDateTimeSchema,
  source_built_at: IsoDateTimeSchema,
  composition_status: MorningBriefCompositionStatusSchema,
  readiness: MorningBriefInputReadinessSchema,
  sections: z.array(MorningBriefComposedSectionSchema),
  governance: MorningBriefGovernanceSummarySchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type MorningBriefCompositionStatus = z.infer<
  typeof MorningBriefCompositionStatusSchema
>;
export type MorningBriefComposedSectionType = z.infer<
  typeof MorningBriefComposedSectionTypeSchema
>;
export type MorningBriefComposerOptions = Partial<
  z.input<typeof MorningBriefComposerOptionsSchema>
>;
export type MorningBriefComposerInput = z.infer<
  typeof MorningBriefComposerInputSchema
>;
export type MorningBriefItem = z.infer<typeof MorningBriefItemSchema>;
export type MorningBriefComposedSection = z.infer<
  typeof MorningBriefComposedSectionSchema
>;
export type MorningBriefGovernanceSummary = z.infer<
  typeof MorningBriefGovernanceSummarySchema
>;
export type MorningBrief = z.infer<typeof MorningBriefSchema>;

export function composeMorningBrief(
  input: MorningBriefRealInput,
  options: MorningBriefComposerOptions = {},
): MorningBrief {
  const parsedInput = MorningBriefRealInputSchema.parse(input);
  const parsedOptions = MorningBriefComposerOptionsSchema.parse(options);
  const readiness = buildMorningBriefInputReadiness(parsedInput);
  const composedAt = parsedOptions.generated_at ?? parsedInput.built_at;
  const base = {
    kind: "morning_brief.composed" as const,
    composer_version: MORNING_BRIEF_COMPOSER_VERSION,
    title: parsedOptions.title ?? titleForStatus(readiness),
    composed_at: composedAt,
    source_built_at: parsedInput.built_at,
    readiness,
    governance: governanceSummary(),
    metadata_only: true,
    raw_body_included: false,
  };

  if (!readiness.minimum_viable_input_exists) {
    return MorningBriefSchema.parse({
      ...base,
      composition_status: "failed_closed",
      sections: [],
    });
  }

  const sections = [
    gmailSection(parsedInput, readiness, parsedOptions),
    calendarSection(parsedInput, readiness, parsedOptions),
    driveSection(parsedInput, readiness, parsedOptions),
    jarvisStatusSection(parsedInput),
    agentPreviewSection(parsedInput),
  ].filter((section): section is MorningBriefComposedSection =>
    Boolean(
      section &&
      (section.item_count > 0 || parsedOptions.include_optional_empty_sections),
    ),
  );

  return MorningBriefSchema.parse({
    ...base,
    composition_status: readiness.status === "ready" ? "composed" : "degraded",
    sections,
  });
}

function gmailSection(
  input: MorningBriefRealInput,
  readiness: MorningBriefInputReadiness,
  options: MorningBriefComposerOptions,
): MorningBriefComposedSection | null {
  const gmail = input.google.gmail;
  if (!gmail) return null;
  const messages = uniqueById([
    ...gmail.unread_messages,
    ...gmail.recent_messages,
  ]).slice(0, options.max_items_per_section);
  const unreadCount = gmail.unread_messages.length;
  const recentCount = gmail.recent_messages.length;
  const domains = sortedUnique(
    messages.flatMap((message) =>
      message.sender_domain ? [message.sender_domain] : [],
    ),
  );
  const labels = sortedUnique(messages.flatMap((message) => message.label_ids));

  return MorningBriefComposedSectionSchema.parse({
    section_type: "gmail",
    title: "Gmail metadata",
    status: readiness.gmail.status === "present" ? "present" : "missing",
    item_count: messages.length,
    summary: `${recentCount} recent and ${unreadCount} unread Gmail metadata records.`,
    items: messages.map((message) => ({
      item_id: message.message_id,
      source: "gmail",
      title: message.subject ?? "Untitled Gmail message",
      summary: `Message from ${message.sender_domain ?? "unknown domain"} at ${
        message.timestamp ?? "unknown time"
      }.`,
      metadata_flags: [
        ...(gmail.unread_messages.some(
          (unread) => unread.message_id === message.message_id,
        )
          ? ["unread"]
          : []),
        ...(message.label_ids.includes("IMPORTANT") ? ["important_label"] : []),
      ],
      source_ref: `gmail://metadata/messages/${message.message_id}`,
      metadata: {
        thread_id: message.thread_id,
        sender_domain: message.sender_domain,
        timestamp: message.timestamp,
        label_ids: message.label_ids,
      },
      metadata_only: true,
      raw_body_included: false,
    })),
    metadata: {
      recent_count: recentCount,
      unread_count: unreadCount,
      sender_domains: domains,
      label_ids: labels,
    },
    metadata_only: true,
    raw_body_included: false,
  });
}

function calendarSection(
  input: MorningBriefRealInput,
  readiness: MorningBriefInputReadiness,
  options: MorningBriefComposerOptions,
): MorningBriefComposedSection | null {
  const calendar = input.google.calendar;
  if (!calendar) return null;
  const events = uniqueById([
    ...calendar.todays_events,
    ...calendar.upcoming_events,
  ]).slice(0, options.max_items_per_section);
  const times = events.flatMap((event) =>
    [event.start_time, event.end_time].filter((value): value is string =>
      Boolean(value),
    ),
  );

  return MorningBriefComposedSectionSchema.parse({
    section_type: "calendar",
    title: "Calendar metadata",
    status: readiness.calendar.status === "present" ? "present" : "missing",
    item_count: events.length,
    summary: `${calendar.todays_events.length} events today and ${calendar.upcoming_events.length} upcoming events.`,
    items: events.map((event) => ({
      item_id: event.event_id,
      source: "calendar",
      title: event.title ?? "Untitled calendar event",
      summary: `Event from ${event.start_time ?? "unknown start"} to ${
        event.end_time ?? "unknown end"
      } with ${event.attendee_count} attendees.`,
      metadata_flags: [
        ...(calendar.todays_events.some(
          (today) => today.event_id === event.event_id,
        )
          ? ["today"]
          : []),
      ],
      source_ref: `calendar://metadata/events/${event.calendar_id}/${event.event_id}`,
      metadata: {
        calendar_id: event.calendar_id,
        start_time: event.start_time,
        end_time: event.end_time,
        attendee_count: event.attendee_count,
        status: event.status,
        organizer_domain: event.organizer_domain,
      },
      metadata_only: true,
      raw_body_included: false,
    })),
    metadata: {
      today_count: calendar.todays_events.length,
      upcoming_count: calendar.upcoming_events.length,
      time_window_start: times.sort()[0] ?? null,
      time_window_end: times.sort()[times.length - 1] ?? null,
    },
    metadata_only: true,
    raw_body_included: false,
  });
}

function driveSection(
  input: MorningBriefRealInput,
  readiness: MorningBriefInputReadiness,
  options: MorningBriefComposerOptions,
): MorningBriefComposedSection | null {
  const drive = input.google.drive;
  if (!drive) return null;
  const files = uniqueById([
    ...drive.recent_files,
    ...drive.search_results,
  ]).slice(0, options.max_items_per_section);
  const mimeTypes = sortedUnique(
    files.flatMap((file) => (file.mime_type ? [file.mime_type] : [])),
  );
  const ownerDomains = sortedUnique(
    files.flatMap((file) => (file.owner_domain ? [file.owner_domain] : [])),
  );

  return MorningBriefComposedSectionSchema.parse({
    section_type: "drive",
    title: "Drive metadata",
    status: readiness.drive.status === "present" ? "present" : "optional",
    item_count: files.length,
    summary: `${drive.recent_files.length} recent and ${drive.search_results.length} searched Drive metadata records.`,
    items: files.map((file) => ({
      item_id: file.file_id,
      source: "drive",
      title: file.file_name ?? "Untitled Drive file",
      summary: `${file.mime_type ?? "Unknown MIME type"} modified at ${
        file.modified_time ?? "unknown time"
      }.`,
      metadata_flags: [],
      source_ref: `drive://metadata/files/${file.file_id}`,
      metadata: {
        mime_type: file.mime_type,
        modified_time: file.modified_time,
        owner_domain: file.owner_domain,
        size_bytes: file.size_bytes,
      },
      metadata_only: true,
      raw_body_included: false,
    })),
    metadata: {
      recent_count: drive.recent_files.length,
      search_result_count: drive.search_results.length,
      mime_types: mimeTypes,
      owner_domains: ownerDomains,
    },
    metadata_only: true,
    raw_body_included: false,
  });
}

function jarvisStatusSection(
  input: MorningBriefRealInput,
): MorningBriefComposedSection | null {
  if (!input.jarvis_status_metadata) return null;
  const keys = Object.keys(input.jarvis_status_metadata).sort();

  return metadataObjectSection({
    section_type: "jarvis_status",
    title: "JARVIS status metadata",
    source_ref: "jarvis://status/metadata",
    keys,
  });
}

function agentPreviewSection(
  input: MorningBriefRealInput,
): MorningBriefComposedSection | null {
  if (!input.agent_preview_metadata) return null;
  const keys = Object.keys(input.agent_preview_metadata).sort();

  return metadataObjectSection({
    section_type: "agent_preview",
    title: "Agent preview metadata",
    source_ref: "jarvis://agents/preview-metadata",
    keys,
  });
}

function metadataObjectSection(input: {
  readonly section_type: "jarvis_status" | "agent_preview";
  readonly title: string;
  readonly source_ref: string;
  readonly keys: readonly string[];
}): MorningBriefComposedSection {
  return MorningBriefComposedSectionSchema.parse({
    section_type: input.section_type,
    title: input.title,
    status: input.keys.length > 0 ? "present" : "optional",
    item_count: input.keys.length,
    summary: `${input.keys.length} metadata keys supplied.`,
    items: input.keys.map((key) => ({
      item_id: `${input.section_type}:${key}`,
      source: input.section_type,
      title: key,
      summary: "Metadata key present.",
      metadata_flags: [],
      source_ref: input.source_ref,
      metadata: { key },
      metadata_only: true,
      raw_body_included: false,
    })),
    metadata: { key_count: input.keys.length, keys: [...input.keys] },
    metadata_only: true,
    raw_body_included: false,
  });
}

function titleForStatus(readiness: MorningBriefInputReadiness): string {
  if (readiness.status === "ready") return "Morning Brief Preview";
  if (readiness.status === "degraded")
    return "Morning Brief Preview (Degraded)";
  return "Morning Brief Preview (Unavailable)";
}

function governanceSummary(): MorningBriefGovernanceSummary {
  return MorningBriefGovernanceSummarySchema.parse({
    read_only: true,
    input_driven: true,
    deterministic: true,
    preview_only: true,
    metadata_governed: true,
    live_google_calls_attempted: false,
    scheduler_invoked: false,
    delivery_attempted: false,
    suggestion_inbox_write_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    filesystem_write_attempted: false,
    database_write_attempted: false,
    approval_execution_attempted: false,
    mutation_attempted: false,
    new_authority_surface_added: false,
    metadata_only: true,
  });
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueById<
  T extends {
    readonly message_id?: string;
    readonly event_id?: string;
    readonly file_id?: string;
  },
>(values: readonly T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const value of values) {
    const id = value.message_id ?? value.event_id ?? value.file_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(value);
  }
  return output;
}
