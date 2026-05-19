import {
  PHASE_3D_FEATURE_LABELS,
  type ConsentFeatureId,
  type ConsentManifest,
} from "../lib/consent/types";

export interface ConsentManifestPanelProps {
  manifest: ConsentManifest | null;
  loading?: boolean;
  updatingFeatureId?: ConsentFeatureId | null;
  onToggle: (featureId: ConsentFeatureId, enabled: boolean) => void;
}

export function ConsentManifestPanel({
  manifest,
  loading = false,
  updatingFeatureId = null,
  onToggle,
}: ConsentManifestPanelProps) {
  const records = manifest?.records ?? [];

  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Consent Manifest
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Phase 3D feature consent gate
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${records.length} features`}
        </span>
      </div>

      {records.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Consent manifest is not loaded.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {records.map((record) => {
            const updating = updatingFeatureId === record.feature_id;
            return (
              <label
                key={record.feature_id}
                className="flex min-h-24 items-start justify-between gap-3 rounded-md border border-gray-800 p-3"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-100">
                    {PHASE_3D_FEATURE_LABELS[record.feature_id]}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {record.scope}
                  </span>
                  <span className="mt-2 block text-xs text-gray-400">
                    {record.enabled ? "Enabled" : "Disabled"}
                  </span>
                </span>
                <input
                  aria-label={`Toggle ${PHASE_3D_FEATURE_LABELS[record.feature_id]}`}
                  type="checkbox"
                  checked={record.enabled}
                  disabled={loading || updating}
                  onChange={(event) =>
                    onToggle(record.feature_id, event.target.checked)
                  }
                  className="mt-1 h-5 w-5 accent-white"
                />
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
