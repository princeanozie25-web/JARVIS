"use client";

import type {
  MemoryWeightingItemType,
  MemoryWeightingProjection,
} from "@/lib/memory-weighting";

export interface MemoryWeightingPreviewPanelProps {
  weights: MemoryWeightingProjection[];
  loading?: boolean;
  consentEnabled?: boolean;
  selectedItemType: MemoryWeightingItemType | "";
  onItemTypeChange: (itemType: MemoryWeightingItemType | "") => void;
}

const TYPE_LABELS: Record<MemoryWeightingItemType, string> = {
  long_term_memory: "Long-Term Memory",
  memory_candidate: "Memory Candidate",
};

const FILTERS: Array<MemoryWeightingItemType | ""> = [
  "",
  "long_term_memory",
  "memory_candidate",
];

function formatScore(value: number): string {
  return value.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "");
}

export function MemoryWeightingPreviewPanel({
  weights,
  loading = false,
  consentEnabled = false,
  selectedItemType,
  onItemTypeChange,
}: MemoryWeightingPreviewPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Memory Weighting Preview
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Preview only / not applied to retrieval
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${weights.length} items`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Memory weighting is disabled until consent is enabled.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((itemType) => (
          <button
            key={itemType || "all"}
            type="button"
            disabled={!consentEnabled}
            onClick={() => onItemTypeChange(itemType)}
            className={`rounded-md border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedItemType === itemType
                ? "border-white bg-white text-black"
                : "border-gray-700 text-gray-300"
            }`}
          >
            {itemType ? TYPE_LABELS[itemType] : "All"}
          </button>
        ))}
      </div>

      {weights.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No memory weights available.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {weights.map((weight) => (
            <article
              key={`${weight.item_type}:${weight.item_id}`}
              className="rounded-md border border-gray-800 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
                    {TYPE_LABELS[weight.item_type]}
                  </span>
                  <span className="text-sm font-semibold text-gray-100">
                    {weight.item_id}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-100">
                  {formatScore(weight.final_weight)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400 sm:grid-cols-4">
                <div>
                  <dt>Base</dt>
                  <dd>{formatScore(weight.base_score)}</dd>
                </div>
                <div>
                  <dt>Recency</dt>
                  <dd>{formatScore(weight.recency_score)}</dd>
                </div>
                <div>
                  <dt>Pin</dt>
                  <dd>{formatScore(weight.pin_score)}</dd>
                </div>
                <div>
                  <dt>Usage</dt>
                  <dd>{formatScore(weight.usage_score)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-500">{weight.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
