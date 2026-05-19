"use client";

import type { HumanReviewItem, HumanReviewStatus } from "@/lib/human-review";

export interface HumanReviewQueuePanelProps {
  items: HumanReviewItem[];
  loading?: boolean;
  consentEnabled?: boolean;
  updatingId?: string | null;
  onUpdateStatus: (
    id: string,
    status: Exclude<HumanReviewStatus, "dismissed">,
  ) => void | Promise<void>;
  onDismiss: (id: string) => void | Promise<void>;
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

function sourceLabel(item: HumanReviewItem): string {
  return `${item.source_type}:${item.source_id}`;
}

function provenanceSummary(provenance: Record<string, unknown>): string {
  const entries = Object.entries(provenance)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 5)
    .map(([key, value]) => {
      const display =
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : JSON.stringify(value);
      return `${key}=${display}`;
    });
  return entries.join(" ");
}

function ItemCard({
  item,
  updating,
  onUpdateStatus,
  onDismiss,
}: {
  item: HumanReviewItem;
  updating: boolean;
  onUpdateStatus: HumanReviewQueuePanelProps["onUpdateStatus"];
  onDismiss: HumanReviewQueuePanelProps["onDismiss"];
}) {
  const disabled = updating;
  return (
    <article className="rounded-md border border-gray-800 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>{item.item_type}</span>
        <span>{item.status}</span>
        <span>{formatTimestamp(item.updated_at)}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-gray-200">{item.title}</h3>
      <p className="mt-2 text-sm text-gray-400">{item.summary}</p>
      <div className="mt-3 rounded border border-gray-900 bg-black p-2 text-xs text-gray-500">
        <p>Source: {sourceLabel(item)}</p>
        <p>Created: {formatTimestamp(item.created_at)}</p>
        {item.decision_reason && <p>Decision: {item.decision_reason}</p>}
        <p>Provenance: {provenanceSummary(item.provenance) || "none"}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || item.status === "accepted"}
          onClick={() => onUpdateStatus(item.id, "accepted")}
          className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Accept Review
        </button>
        <button
          type="button"
          disabled={disabled || item.status === "rejected"}
          onClick={() => onUpdateStatus(item.id, "rejected")}
          className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject Review
        </button>
        <button
          type="button"
          disabled={disabled || item.status === "pending"}
          onClick={() => onUpdateStatus(item.id, "pending")}
          className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Return Pending
        </button>
        <button
          type="button"
          disabled={disabled || item.status === "dismissed"}
          onClick={() => onDismiss(item.id)}
          className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

export function HumanReviewQueuePanel({
  items,
  loading = false,
  consentEnabled = false,
  updatingId = null,
  onUpdateStatus,
  onDismiss,
}: HumanReviewQueuePanelProps) {
  const pending = items.filter((item) => item.status === "pending");
  const history = items.filter((item) => item.status !== "pending");

  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Human Review Queue
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Manual inbox only; decisions do not write memories or change prompts
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${items.length} items`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Human Review Queue is disabled until consent is enabled.
        </p>
      )}

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Pending Review Inbox
        </h3>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No pending review items.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pending.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                updating={updatingId === item.id || !consentEnabled}
                onUpdateStatus={onUpdateStatus}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Review History
        </h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No accepted, rejected, or dismissed review items.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                updating={updatingId === item.id || !consentEnabled}
                onUpdateStatus={onUpdateStatus}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
