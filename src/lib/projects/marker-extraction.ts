export type ProjectMarkerArtifactKind = "task" | "blocker";

export interface ProjectMarkerArtifact {
  kind: ProjectMarkerArtifactKind;
  marker: string;
  text: string;
  line: number;
  column: number;
  confidence?: number;
}

const TASK_MARKERS = ["TODO:", "FIXME:", "#task"] as const;
const BLOCKER_MARKERS = ["#blocked", "blocked by", "waiting on"] as const;

export const PROJECT_MARKER_TASK_CONFIDENCE = {
  "TODO:": 0.85,
  "FIXME:": 0.9,
  "#task": 0.8,
} as const;

export const PROJECT_MARKER_BLOCKER_MARKERS = BLOCKER_MARKERS;
export const PROJECT_MARKER_TASK_MARKERS = TASK_MARKERS;

function findMarker(line: string, markers: readonly string[]) {
  const lowered = line.toLowerCase();
  return markers
    .map((marker) => ({
      marker,
      index: lowered.indexOf(marker.toLowerCase()),
    }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
}

function markerText(line: string, marker: string, index: number): string {
  const text = line.slice(index + marker.length).trim();
  return text || marker;
}

export function extractProjectMarkers(
  content: string,
): ProjectMarkerArtifact[] {
  const artifacts: ProjectMarkerArtifact[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;
    const task = findMarker(line, TASK_MARKERS);
    if (task) {
      artifacts.push({
        kind: "task",
        marker: task.marker,
        text: markerText(line, task.marker, task.index),
        line: lineNumber,
        column: task.index + 1,
        confidence:
          PROJECT_MARKER_TASK_CONFIDENCE[
            task.marker as keyof typeof PROJECT_MARKER_TASK_CONFIDENCE
          ],
      });
    }

    const blocker = findMarker(line, BLOCKER_MARKERS);
    if (blocker) {
      artifacts.push({
        kind: "blocker",
        marker: blocker.marker,
        text: markerText(line, blocker.marker, blocker.index),
        line: lineNumber,
        column: blocker.index + 1,
      });
    }
  }

  return artifacts;
}
