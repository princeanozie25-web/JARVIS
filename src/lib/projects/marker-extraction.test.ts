import { describe, expect, it } from "vitest";
import {
  extractProjectMarkers,
  PROJECT_MARKER_TASK_CONFIDENCE,
} from "./marker-extraction";

describe("project deterministic marker extraction", () => {
  it("extracts only supported task and blocker markers with deterministic confidence", () => {
    const markers = extractProjectMarkers(
      [
        "TODO: finish approval copy",
        "FIXME: tighten snapshot count",
        "note #task document A7 markers",
        "#blocked waiting for fixture",
        "blocked by schema migration",
        "waiting on review",
        "ordinary sentence",
      ].join("\n"),
    );

    expect(markers).toEqual([
      {
        kind: "task",
        marker: "TODO:",
        text: "finish approval copy",
        line: 1,
        column: 1,
        confidence: PROJECT_MARKER_TASK_CONFIDENCE["TODO:"],
      },
      {
        kind: "task",
        marker: "FIXME:",
        text: "tighten snapshot count",
        line: 2,
        column: 1,
        confidence: PROJECT_MARKER_TASK_CONFIDENCE["FIXME:"],
      },
      {
        kind: "task",
        marker: "#task",
        text: "document A7 markers",
        line: 3,
        column: 6,
        confidence: PROJECT_MARKER_TASK_CONFIDENCE["#task"],
      },
      {
        kind: "blocker",
        marker: "#blocked",
        text: "waiting for fixture",
        line: 4,
        column: 1,
      },
      {
        kind: "blocker",
        marker: "blocked by",
        text: "schema migration",
        line: 5,
        column: 1,
      },
      {
        kind: "blocker",
        marker: "waiting on",
        text: "review",
        line: 6,
        column: 1,
      },
    ]);
  });
});
