import type { MemoryCandidateRow } from "@/lib/db/node";

export interface MemoryCandidateReviewPanelProps {
  candidates: MemoryCandidateRow[];
  loading?: boolean;
  onReject?: (candidateId: string) => void;
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function formatDate(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "Not reviewed";
}

export function MemoryCandidateReviewPanel({
  candidates,
  loading = false,
  onReject,
}: MemoryCandidateReviewPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Memory Candidates
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Draft distillation candidates for manual review
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${candidates.length} candidates`}
        </span>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No memory candidates generated yet.
        </p>
      ) : (
        <div className="mt-4 max-h-72 overflow-y-auto space-y-3">
          {candidates.map((candidate) => {
            const tags = parseTags(candidate.proposed_tags_json);
            const rejectDisabled =
              candidate.status === "rejected" ||
              candidate.status === "accepted";
            return (
              <article
                key={candidate.id}
                className="border border-gray-800 rounded-md p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>{candidate.proposed_category}</span>
                  <span>{candidate.proposed_sensitivity}</span>
                  <span>{candidate.status}</span>
                  <span>{formatDate(candidate.reviewed_at)}</span>
                </div>
                <p className="mt-2 text-sm text-gray-100">
                  {candidate.proposed_content}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {candidate.rationale}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  {tags.length === 0
                    ? "No tags"
                    : tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled
                    title="Accept will write to long-term memory in a later phase."
                    className="rounded border border-gray-800 px-3 py-1 text-xs text-gray-600 disabled:cursor-not-allowed"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Edit will be enabled when candidate promotion is implemented."
                    className="rounded border border-gray-800 px-3 py-1 text-xs text-gray-600 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={rejectDisabled}
                    onClick={() => onReject?.(candidate.id)}
                    className="rounded border border-red-900 px-3 py-1 text-xs text-red-200 disabled:cursor-not-allowed disabled:text-gray-600 disabled:border-gray-800"
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
