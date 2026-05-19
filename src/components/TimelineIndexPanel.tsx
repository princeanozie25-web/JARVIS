"use client";

import type { TimelineEntry, TimelineEntryType } from "@/lib/timeline";

export interface TimelineIndexPanelProps {
  entries: TimelineEntry[];
  loading?: boolean;
  consentEnabled?: boolean;
  selectedType: TimelineEntryType | "";
  onTypeChange: (type: TimelineEntryType | "") => void;
}

const TYPE_LABELS: Record<TimelineEntryType, string> = {
  session_summary: "Session Summary",
  project_state: "Project State",
  goal: "Goal",
  preference: "Preference",
};

const TIMELINE_FILTERS: Array<TimelineEntryType | ""> = [
  "",
  "session_summary",
  "project_state",
  "goal",
  "preference",
];

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

export function TimelineIndexPanel({
  entries,
  loading = false,
  consentEnabled = false,
  selectedType,
  onTypeChange,
}: TimelineIndexPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Timeline Index
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only summaries and projections
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${entries.length} entries`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Timeline is disabled until consent is enabled.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TIMELINE_FILTERS.map((type) => (
          <button
            key={type || "all"}
            type="button"
            disabled={!consentEnabled}
            onClick={() => onTypeChange(type)}
            className={`rounded-md border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedType === type
                ? "border-white bg-white text-black"
                : "border-gray-700 text-gray-300"
            }`}
          >
            {type ? TYPE_LABELS[type] : "All"}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No timeline projections available.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border-l border-gray-800 pl-4">
              <article className="rounded-md border border-gray-800 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
                    {TYPE_LABELS[entry.type]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-100">
                  {entry.title}
                </h3>
                <p className="mt-2 text-sm text-gray-300">{entry.summary}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {entry.source_label} - {entry.projection_notice}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
