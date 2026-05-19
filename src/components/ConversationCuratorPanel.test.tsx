import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CuratorAuditRow,
  CuratorRecordRow,
  MemoryCandidateRow,
  SessionSummaryRow,
} from "@/lib/db/node";
import { ConversationCuratorPanel } from "./ConversationCuratorPanel";

const summary: SessionSummaryRow = {
  session_id: "session-1",
  summary_text: "Manual curator source summary.",
  previous_summary_hash: null,
  summary_hash: "sum-1",
  covered_message_count: 4,
  created_at: 1_000,
  updated_at: 1_000,
};

const candidate: MemoryCandidateRow = {
  id: "cand-1",
  session_id: "session-1",
  source_message_ids_json: '["m1"]',
  proposed_category: "decision",
  proposed_content: "Candidate content.",
  proposed_tags_json: "[]",
  proposed_sensitivity: "personal",
  rationale: "Candidate rationale.",
  status: "draft",
  created_at: 2_000,
  reviewed_at: null,
};

const record: CuratorRecordRow = {
  id: "record-1",
  record_type: "manual_note",
  title: "Manual note",
  content: "Derived note.",
  source_type: "summary",
  source_ids_json: '["sum-1"]',
  derived_from_ids_json: '["sum-1"]',
  source_session_id: "session-1",
  status: "active",
  created_at: 3_000,
};

const audit: CuratorAuditRow = {
  id: "audit-1",
  action_type: "curator_split",
  target_type: "summary",
  target_ids_json: '["sum-1"]',
  derived_record_ids_json: '["record-1"]',
  source_session_id: "session-1",
  provenance_json: '{"original_ids_preserved":true}',
  notes: "manual curation: split summary into manual notes",
  created_at: 4_000,
  created_by: "user",
};

describe("ConversationCuratorPanel", () => {
  it("renders manual curation controls and provenance display", () => {
    const html = renderToStaticMarkup(
      <ConversationCuratorPanel
        summaries={[summary]}
        candidates={[candidate]}
        records={[record]}
        audit={[audit]}
        consentEnabled
        onAction={() => undefined}
      />,
    );

    expect(html).toContain("Conversation Curator");
    expect(html).toContain("Manual curation with provenance");
    expect(html).toContain("Mark Important");
    expect(html).toContain("Demote");
    expect(html).toContain("Archive");
    expect(html).toContain("Safe Delete");
    expect(html).toContain("Merge Summaries");
    expect(html).toContain("Split Summary Into Manual Notes");
    expect(html).toContain("Edit History");
    expect(html).toContain("manual curation: split summary into manual notes");
  });

  it("shows disabled consent state", () => {
    const html = renderToStaticMarkup(
      <ConversationCuratorPanel
        summaries={[]}
        candidates={[]}
        records={[]}
        audit={[]}
        consentEnabled={false}
        onAction={() => undefined}
      />,
    );

    expect(html).toContain(
      "Conversation Curator is disabled until consent is enabled.",
    );
    expect(html).toContain("No manual curation actions recorded.");
  });
});
