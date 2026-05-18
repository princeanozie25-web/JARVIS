import type { ProjectStateRow } from "@/lib/db/node";

export interface ProjectContinuityPanelProps {
  projects: ProjectStateRow[];
  loading?: boolean;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function parseOpenThreads(openThreadsJson: string): string[] {
  try {
    const parsed = JSON.parse(openThreadsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((thread): thread is string => typeof thread === "string")
      : [];
  } catch {
    return [];
  }
}

export function ProjectContinuityPanel({
  projects,
  loading = false,
}: ProjectContinuityPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Project Continuity
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only project state foundation
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${projects.length} projects`}
        </span>
      </div>

      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No project continuity stored yet.
        </p>
      ) : (
        <div className="mt-4 max-h-72 overflow-y-auto space-y-3">
          {projects.map((project) => {
            const openThreads = parseOpenThreads(project.open_threads_json);
            return (
              <article
                key={project.project_id}
                className="border border-gray-800 rounded-md p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-100">
                    {project.project_name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {formatDate(project.updated_at)}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">
                      Where Left Off
                    </dt>
                    <dd className="mt-1 text-gray-200">
                      {project.last_action_summary}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">
                      Next Intended Step
                    </dt>
                    <dd className="mt-1 text-gray-200">
                      {project.next_intended_step ?? "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">
                      Open Threads
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
                      {openThreads.length === 0
                        ? "None"
                        : openThreads.map((thread) => (
                            <span
                              key={thread}
                              className="rounded border border-gray-800 px-2 py-1"
                            >
                              {thread}
                            </span>
                          ))}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
