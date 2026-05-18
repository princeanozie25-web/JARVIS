export const MEMORY_SENSITIVITY_TIERS = [
  "public",
  "personal",
  "sensitive",
  "restricted",
] as const;

export type MemorySensitivity = (typeof MEMORY_SENSITIVITY_TIERS)[number];

export const LONG_TERM_MEMORY_CATEGORIES = [
  "fact",
  "preference",
  "event",
  "decision",
] as const;

export type LongTermMemoryCategory =
  (typeof LONG_TERM_MEMORY_CATEGORIES)[number];

export const MEMORY_NOTE_SOURCES = ["distilled", "user", "tool"] as const;

export type MemoryNoteSource = (typeof MEMORY_NOTE_SOURCES)[number];

export interface LongTermMemoryRow {
  id: string;
  category: LongTermMemoryCategory;
  content: string;
  source: MemoryNoteSource;
  source_id: string | null;
  project: string | null;
  tags_json: string;
  sensitivity: MemorySensitivity;
  created_at: number;
  updated_at: number;
  obsidian_path: string | null;
  hash: string;
  status: "active" | "archived" | "draft";
}

export type SearchableMemorySensitivity = "public" | "personal";

export interface LongTermMemorySearchRow extends LongTermMemoryRow {
  rank: number | null;
}
