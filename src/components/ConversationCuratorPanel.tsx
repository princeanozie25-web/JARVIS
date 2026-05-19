"use client";

import { useState } from "react";
import type {
  CuratorAuditRow,
  CuratorRecordRow,
  MemoryCandidateRow,
  SessionSummaryRow,
} from "@/lib/db/node";
import type { CuratorManualAction, CuratorTargetType } from "@/lib/curator";

export type CuratorUiOperation =
  | CuratorManualAction
  | "archive"
  | "delete"
  | "merge_summaries"
  | "split_summary";

export interface CuratorActionRequest {
  operation: CuratorUiOperation;
  targetType?: Exclude<CuratorTargetType, "mixed">;
  targetId?: string;
  summaryHashes?: string[];
  title?: string;
  mergedText?: string;
  summaryHash?: string;
  notes?: Array<{ title: string; content: string }>;
}

export interface ConversationCuratorPanelProps {
  summaries: SessionSummaryRow[];
  candidates: MemoryCandidateRow[];
  records: CuratorRecordRow[];
  audit: CuratorAuditRow[];
  loading?: boolean;
  consentEnabled?: boolean;
  submitting?: boolean;
  onAction: (input: CuratorActionRequest) => void | Promise<void>;
}

interface TargetOption {
  id: string;
  type: Exclude<CuratorTargetType, "mixed">;
  label: string;
  sourceSessionId: string | null;
}

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function targetOptions(
  summaries: SessionSummaryRow[],
  candidates: MemoryCandidateRow[],
  records: CuratorRecordRow[],
): TargetOption[] {
  return [
    ...summaries.map((summary) => ({
      id: summary.summary_hash,
      type: "summary" as const,
      label: `Summary ${summary.session_id}`,
      sourceSessionId: summary.session_id,
    })),
    ...candidates.map((candidate) => ({
      id: candidate.id,
      type: "candidate" as const,
      label: `Candidate ${candidate.id}`,
      sourceSessionId: candidate.session_id,
    })),
    ...records.map((record) => ({
      id: record.id,
      type: "curator_record" as const,
      label: `${record.record_type} ${record.title}`,
      sourceSessionId: record.source_session_id,
    })),
  ];
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

export function ConversationCuratorPanel({
  summaries,
  candidates,
  records,
  audit,
  loading = false,
  consentEnabled = false,
  submitting = false,
  onAction,
}: ConversationCuratorPanelProps) {
  const options = targetOptions(summaries, candidates, records);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [mergeIds, setMergeIds] = useState("");
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeText, setMergeText] = useState("");
  const [splitHash, setSplitHash] = useState("");
  const [splitTitle, setSplitTitle] = useState("");
  const [splitContent, setSplitContent] = useState("");

  const selected = options.find(
    (option) => `${option.type}:${option.id}` === selectedTarget,
  );
  const selectedRecord =
    selected?.type === "curator_record"
      ? records.find((record) => record.id === selected.id)
      : undefined;
  const selectedHistory = selected
    ? audit.filter((row) =>
        parseList(row.target_ids_json).includes(selected.id),
      )
    : [];

  async function submitTargetAction(operation: CuratorUiOperation) {
    if (
      !selected ||
      operation === "merge_summaries" ||
      operation === "split_summary"
    ) {
      return;
    }
    await onAction({
      operation,
      targetType: selected.type,
      targetId: selected.id,
    });
  }

  async function submitMerge() {
    const ids = mergeIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length < 2 || !mergeTitle.trim() || !mergeText.trim()) return;
    await onAction({
      operation: "merge_summaries",
      summaryHashes: ids,
      title: mergeTitle.trim(),
      mergedText: mergeText.trim(),
    });
    setMergeIds("");
    setMergeTitle("");
    setMergeText("");
  }

  async function submitSplit() {
    if (!splitHash.trim() || !splitTitle.trim() || !splitContent.trim()) return;
    await onAction({
      operation: "split_summary",
      summaryHash: splitHash.trim(),
      notes: [{ title: splitTitle.trim(), content: splitContent.trim() }],
    });
    setSplitHash("");
    setSplitTitle("");
    setSplitContent("");
  }

  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Conversation Curator
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Manual curation with provenance and audit history
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${audit.length} audit records`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Conversation Curator is disabled until consent is enabled.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3">
        <select
          aria-label="Curator target"
          value={selectedTarget}
          onChange={(event) => setSelectedTarget(event.target.value)}
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        >
          <option value="">Select summary, candidate, or curator record</option>
          {options.map((option) => (
            <option
              key={`${option.type}:${option.id}`}
              value={`${option.type}:${option.id}`}
            >
              {option.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selected || !consentEnabled || submitting}
            onClick={() => submitTargetAction("mark_important")}
            className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark Important
          </button>
          <button
            type="button"
            disabled={!selected || !consentEnabled || submitting}
            onClick={() => submitTargetAction("demote")}
            className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Demote
          </button>
          <button
            type="button"
            disabled={!selected || !consentEnabled || submitting}
            onClick={() => submitTargetAction("archive")}
            className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            disabled={!selected || !consentEnabled || submitting}
            onClick={() => submitTargetAction("delete")}
            className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Safe Delete
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-gray-800 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Provenance
        </h3>
        {selected ? (
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            <p>
              Original source session:{" "}
              {selected.sourceSessionId ?? "mixed or unknown"}
            </p>
            <p>
              Derived from ids:{" "}
              {selectedRecord
                ? parseList(selectedRecord.derived_from_ids_json).join(", ") ||
                  "none"
                : selected.id}
            </p>
            <p>Edit history records: {selectedHistory.length}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Select an item to view its provenance chain.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-md border border-gray-800 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Merge Summaries
        </h3>
        <input
          aria-label="Summary hashes to merge"
          value={mergeIds}
          onChange={(event) => setMergeIds(event.target.value)}
          placeholder="summary_hash_1, summary_hash_2"
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <input
          aria-label="Merged summary title"
          value={mergeTitle}
          onChange={(event) => setMergeTitle(event.target.value)}
          placeholder="Merged summary title"
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <textarea
          aria-label="Merged summary text"
          value={mergeText}
          onChange={(event) => setMergeText(event.target.value)}
          placeholder="Manual merged summary"
          rows={3}
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!consentEnabled || submitting}
          onClick={submitMerge}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Merged Record
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-md border border-gray-800 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Split Summary Into Manual Notes
        </h3>
        <input
          aria-label="Summary hash to split"
          value={splitHash}
          onChange={(event) => setSplitHash(event.target.value)}
          placeholder="summary_hash"
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <input
          aria-label="Manual note title"
          value={splitTitle}
          onChange={(event) => setSplitTitle(event.target.value)}
          placeholder="Manual note title"
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <textarea
          aria-label="Manual note content"
          value={splitContent}
          onChange={(event) => setSplitContent(event.target.value)}
          placeholder="Manual note content"
          rows={3}
          disabled={!consentEnabled || submitting}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!consentEnabled || submitting}
          onClick={submitSplit}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Manual Note
        </button>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Edit History
        </h3>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No manual curation actions recorded.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {audit.slice(0, 10).map((row) => (
              <article
                key={row.id}
                className="rounded-md border border-gray-800 p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{row.action_type}</span>
                  <span>{row.target_type}</span>
                  <span>{formatTimestamp(row.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-gray-300">{row.notes}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
