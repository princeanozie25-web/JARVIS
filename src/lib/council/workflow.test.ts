import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildCouncilCouncilRun,
  buildCouncilMemberResponse,
  buildCouncilModeCloseoutReport,
  buildCouncilReview,
  buildCouncilReviewSet,
  buildCouncilSynthesis,
  summarizeCouncilResponses,
  summarizeCouncilReviews,
  summarizeCouncilSynthesis,
  type CouncilMember,
  type CouncilQuestion,
} from "./workflow";

const question: CouncilQuestion = {
  question_id: "question:phase21-risk",
  prompt: "Should this workflow be treated as advisory-only?",
  task_class: "risk_review",
  metadata_only: true,
};

const members: CouncilMember[] = [
  {
    member_id: "member:claude",
    display_name: "Claude",
    provider_class: "claude",
    capabilities: ["reasoning", "critique"],
    fixture_only: true,
    provider_call_attempted: false,
  },
  {
    member_id: "member:gpt",
    display_name: "GPT",
    provider_class: "gpt",
    capabilities: ["reasoning", "synthesis_support"],
    fixture_only: true,
    provider_call_attempted: false,
  },
  {
    member_id: "member:gemini",
    display_name: "Gemini",
    provider_class: "gemini",
    capabilities: ["critique", "risk_review"],
    fixture_only: true,
    provider_call_attempted: false,
  },
  {
    member_id: "member:deepseek",
    display_name: "DeepSeek",
    provider_class: "deepseek",
    capabilities: ["reasoning", "risk_review"],
    fixture_only: true,
    provider_call_attempted: false,
  },
  {
    member_id: "member:local",
    display_name: "Local Model",
    provider_class: "local_model",
    capabilities: ["reasoning", "critique"],
    fixture_only: true,
    provider_call_attempted: false,
  },
];

describe("Council Mode workflow", () => {
  it("builds deterministic fixture member responses with metadata preserved", () => {
    const response = buildCouncilMemberResponse({
      question,
      member: members[0],
      answer_summary:
        "Keep Council Mode advisory-only and route actions elsewhere.",
      confidence: "high",
      caveats: ["No live provider participated."],
    });
    const repeated = buildCouncilMemberResponse({
      question,
      member: members[0],
      answer_summary:
        "Keep Council Mode advisory-only and route actions elsewhere.",
      confidence: "high",
      caveats: ["No live provider participated."],
    });

    expect(response).toEqual(repeated);
    expect(response).toMatchObject({
      response_id: "council-response:question:phase21-risk:member:claude",
      question_id: "question:phase21-risk",
      member_id: "member:claude",
      confidence: "high",
      advisory_only: true,
      execution_attempted: false,
      metadata: {
        capability_count: 2,
        fixture_response: true,
        provider_call_attempted: false,
        model_call_attempted: false,
        network_call_attempted: false,
      },
    });
  });

  it("summarizes council responses and creates a run without provider calls", () => {
    const run = buildCouncilCouncilRun({
      run_id: "council-run:phase21-risk",
      question,
      members,
    });
    const summary = summarizeCouncilResponses(run.responses);

    expect(run.responses).toHaveLength(5);
    expect(run.advisory_only).toBe(true);
    expect(run.provider_call_attempted).toBe(false);
    expect(run.execution_attempted).toBe(false);
    expect(summary).toEqual({
      response_count: 5,
      confidence_counts: {
        high: 1,
        medium: 4,
        low: 0,
        unknown: 0,
      },
      caveat_count: 5,
      advisory_only: true,
      provider_call_attempted: false,
      execution_attempted: false,
    });
  });

  it("builds anonymous review sets with provider identity hidden", () => {
    const responses = buildCouncilCouncilRun({
      run_id: "council-run:phase21-risk",
      question,
      members: members.slice(0, 3),
    }).responses;
    const reviews = buildCouncilReviewSet(responses);
    const summary = summarizeCouncilReviews(reviews);

    expect(reviews).toHaveLength(6);
    for (const review of reviews) {
      expect(review.provider_identity_hidden).toBe(true);
      expect(review.critique_only).toBe(true);
      expect(review.advisory_only).toBe(true);
      expect(review.execution_attempted).toBe(false);
      expect(review.reviewer_alias).toMatch(/^anonymous-reviewer-/);
      expect(review.subject_alias).toMatch(/^anonymous-response-/);
      expect(JSON.stringify(review)).not.toMatch(
        /claude|gpt|gemini|deepseek|local_model/i,
      );
    }
    expect(summary).toMatchObject({
      review_count: 6,
      provider_identity_hidden: true,
      critique_only: true,
      advisory_only: true,
      execution_attempted: false,
    });
  });

  it("creates individual review decisions deterministically", () => {
    const lowConfidence = buildCouncilMemberResponse({
      question,
      member: members[1],
      answer_summary: "This answer should be challenged.",
      confidence: "low",
      caveats: ["Low-confidence fixture."],
    });

    expect(
      buildCouncilReview({
        reviewer_alias: "anonymous-reviewer-1",
        subject_alias: "anonymous-response-2",
        subject_response: lowConfidence,
      }),
    ).toMatchObject({
      decision: "challenge",
      provider_identity_hidden: true,
      critique_only: true,
      advisory_only: true,
    });
  });

  it("builds chairman synthesis with confidence and disagreement summaries", () => {
    const run = buildCouncilCouncilRun({
      run_id: "council-run:phase21-risk",
      question,
      members: members.slice(0, 3),
      responses: [
        buildCouncilMemberResponse({
          question,
          member: members[0],
          answer_summary:
            "Treat the council as an advisory reasoning workflow.",
          confidence: "high",
          caveats: ["No approval should happen here."],
        }),
        buildCouncilMemberResponse({
          question,
          member: members[1],
          answer_summary: "Use anonymous review before the chairman synthesis.",
          confidence: "medium",
          caveats: ["Fixture reasoning only."],
        }),
        buildCouncilMemberResponse({
          question,
          member: members[2],
          answer_summary: "Retain caveats and disagreement metadata.",
          confidence: "low",
          caveats: ["Low confidence fixture."],
        }),
      ],
    });
    const reviews = buildCouncilReviewSet(run.responses);
    const synthesis = buildCouncilSynthesis({
      question,
      responses: run.responses,
      reviews,
    });
    const reasoningSummary = summarizeCouncilSynthesis(synthesis);

    expect(synthesis.final_answer.answer_summary).toContain(
      "Advisory synthesis for risk_review",
    );
    expect(synthesis.final_answer).toMatchObject({
      advisory_only: true,
      execution_attempted: false,
      approval_attempted: false,
    });
    expect(synthesis).toMatchObject({
      confidence: "medium",
      advisory_only: true,
      provider_call_attempted: false,
      model_call_attempted: false,
      network_call_attempted: false,
      execution_attempted: false,
      mutation_attempted: false,
    });
    expect(reasoningSummary.confidence_summary).toBe(
      "Confidence distribution: high=1, medium=1, low=1, unknown=0.",
    );
    expect(reasoningSummary.disagreement_summary).toContain("challenge=");
  });

  it("reports closeout through advisory reasoning boundary only", () => {
    const report = buildCouncilModeCloseoutReport();

    expect(report.title).toBe(
      "Council workflow complete through advisory reasoning boundary",
    );
    expect(report.components).toEqual([
      "council_members",
      "council_responses",
      "anonymous_reviews",
      "chairman_synthesis",
    ]);
    expect(report.governance).toEqual({
      advisory_only: true,
      no_provider_model_calls: true,
      no_network_calls: true,
      no_execution: true,
      no_approvals: true,
      no_mutations: true,
      no_state_changes: true,
      no_scheduler_execution: true,
      no_inbox_writes: true,
      no_file_writes: true,
      no_authority_escalation: true,
      no_new_authority_surface: true,
    });
    expect(report.readme_safe_wording.join(" ")).toContain(
      "Council Mode is advisory only and cannot approve, execute, mutate, or escalate authority.",
    );
  });

  it("does not include provider, network, execution, approval, or mutation affordances", () => {
    const source = readFileSync("src/lib/council/workflow.ts", "utf8");

    expect(source).not.toMatch(/from\s+["'](?:node:)?fs/);
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:openai|anthropic|google|gemini|deepseek)/i,
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(?:axios|WebSocket|XMLHttpRequest)\b/);
    expect(source).not.toMatch(
      /\b(?:createChatCompletion|generateContent|messages\.create)\b/,
    );
    expect(source).not.toMatch(
      /(?:export\s+function|function|const)\s+\w*(?:executeApproved|approve|finalizeApproval|dispatchAction)/i,
    );
    expect(source).not.toMatch(/\b(?:writeFile|appendFile|mkdir|rm|unlink)\b/);
    expect(source).not.toMatch(/\b(?:sqlite|better-sqlite3|db\.)\b/i);
    expect(source).not.toMatch(
      /\b(?:setInterval|setTimeout|cron|scheduleJob)\b/i,
    );
  });
});
