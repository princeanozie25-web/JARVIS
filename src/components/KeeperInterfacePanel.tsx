"use client";

import type { KeeperMetadata } from "@/lib/keepers";

export interface KeeperInterfacePanelProps {
  keepers: KeeperMetadata[];
  loading?: boolean;
  consentEnabled?: boolean;
}

export function KeeperInterfacePanel({
  keepers,
  loading = false,
  consentEnabled = false,
}: KeeperInterfacePanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Keeper Interface
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Skeleton metadata registry; inert and no execution endpoint
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${keepers.length} registered`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Keeper Interface is disabled until consent is enabled.
        </p>
      )}

      <div className="mt-4 rounded-md border border-gray-800 bg-black p-3">
        <p className="text-sm text-gray-300">No concrete Keepers installed.</p>
        <p className="mt-1 text-xs text-gray-500">
          Registration stores metadata only. No Keeper can run, read memory,
          write memory, or change prompts from this skeleton.
        </p>
      </div>

      {keepers.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No Keeper metadata registered.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {keepers.map((keeper) => (
            <article
              key={keeper.id}
              className="rounded-md border border-gray-800 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-100">
                  {keeper.name}
                </h3>
                <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
                  {keeper.status}
                </span>
                <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
                  {keeper.requiredConsentFeature}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-300">{keeper.description}</p>
              <p className="mt-2 text-xs text-gray-500">
                Operations metadata:{" "}
                {keeper.supportedOperations.join(", ") || "none"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Data classes metadata: {keeper.dataClasses.join(", ") || "none"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
