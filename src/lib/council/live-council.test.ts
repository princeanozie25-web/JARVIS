import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  LIVE_COUNCIL_MEMBER_IDS,
  buildCouncilAnonymizedReviewPacket,
  buildCouncilRealizationCloseoutReport,
  buildLiveCouncilProviderPlan,
  estimateCouncilCost,
  evaluateCouncilCostGate,
  runCouncilAnswerStage,
  runCouncilChairmanStage,
  runCouncilReviewStage,
  runLiveCouncil,
  selectCouncilChairman,
  summarizeLiveCouncilProviderPlan,
  summarizeLiveCouncilRun,
  type CouncilBudgetPolicy,
  type CouncilProviderRequest,
  type CouncilProviderResult,
  type CouncilProviderRunner,
} from "./live-council";
import type { CouncilQuestion } from "./workflow";

const question: CouncilQuestion = {
  question_id: "question:phase21f-r",
  prompt:
    "Should JARVIS open live Council Mode, and what governance boundaries should apply?",
  task_class: "planning",
  metadata_only: true,
};

const confirmedBudget: CouncilBudgetPolicy = {
  policy_id: "budget-policy:council-live",
  user_confirmation_received: true,
  budget_cap_usd: 1,
  budget_remaining_usd: 1,
  metadata_only: true,
};

describe("Live Council realization", () => {
  it("plans Prince's target roster without Gemini and degrades safely for unavailable local smart", () => {
    const plan = buildLiveCouncilProviderPlan({ question });

    expect(plan.target_roster).toEqual([
      "claude",
      "gpt",
      "deepseek",
      "local_fast",
      "local_smart",
    ]);
    expect(LIVE_COUNCIL_MEMBER_IDS).not.toContain("gemini");
    expect(plan.gemini_included).toBe(false);
    expect(plan.default_cloud_dispatch_enabled).toBe(false);
    expect(plan.cost_gate_required).toBe(true);
    expect(plan.available_member_count).toBe(4);
    expect(plan.dispatch_status).toBe("degraded");
    expect(
      plan.members.find((member) => member.member_id === "local_smart"),
    ).toMatchObject({
      availability: "unavailable",
      reason_if_skipped:
        "Local Smart is unavailable until local calibration is complete.",
    });
    expect(plan.chairman).toMatchObject({
      chairman_member_id: "claude",
      explicit: true,
    });
    expect(summarizeLiveCouncilProviderPlan(plan)).toContain(
      "4/5 council members available",
    );
  });

  it("requires at least two available members before live dispatch", () => {
    const plan = buildLiveCouncilProviderPlan({
      question,
      availability: {
        claude: "available",
        gpt: "unavailable",
        deepseek: "unavailable",
        local_fast: "unavailable",
        local_smart: "unavailable",
      },
    });
    const gate = evaluateCouncilCostGate({
      plan,
      policy: confirmedBudget,
    });

    expect(plan.available_member_count).toBe(1);
    expect(plan.dispatch_status).toBe("blocked");
    expect(gate).toMatchObject({
      status: "blocked",
      reason: "insufficient_available_members",
      dispatch_allowed: false,
      provider_call_attempted: false,
    });
  });

  it("selects an explicit chairman with governed fallbacks", () => {
    const basePlan = buildLiveCouncilProviderPlan({ question });
    expect(selectCouncilChairman(basePlan.members, "planning")).toMatchObject({
      chairman_member_id: "claude",
      chairman_model_id: "cloud-frontier",
      explicit: true,
    });

    const fallbackPlan = buildLiveCouncilProviderPlan({
      question,
      availability: {
        claude: "unavailable",
        gpt: "available",
        deepseek: "available",
        local_fast: "available",
        local_smart: "unavailable",
      },
    });
    expect(
      selectCouncilChairman(fallbackPlan.members, "planning"),
    ).toMatchObject({
      chairman_member_id: "deepseek",
      chairman_model_id: "deepseek-v4-pro",
    });
  });

  it("estimates answer, review, and chairman costs before dispatch", () => {
    const plan = buildLiveCouncilProviderPlan({ question });
    const estimate = estimateCouncilCost(plan);

    expect(estimate.answer_stage_cost_usd).toBe(0.06);
    expect(estimate.review_stage_cost_usd).toBe(0.18);
    expect(estimate.chairman_stage_cost_usd).toBe(0.03);
    expect(estimate.total_estimated_cost_usd).toBe(0.27);
    expect(estimate.local_stage_cost_usd).toBe(0);
    expect(estimate.unknown_pricing_warnings).toEqual([]);
  });

  it("fails the cost gate closed without confirmation or when budget is exceeded", () => {
    const plan = buildLiveCouncilProviderPlan({ question });

    expect(
      evaluateCouncilCostGate({
        plan,
        policy: {
          ...confirmedBudget,
          user_confirmation_received: false,
        },
      }),
    ).toMatchObject({
      status: "blocked",
      reason: "confirmation_missing",
      dispatch_allowed: false,
    });

    expect(
      evaluateCouncilCostGate({
        plan,
        policy: {
          ...confirmedBudget,
          budget_cap_usd: 0.01,
          budget_remaining_usd: 0.01,
        },
      }),
    ).toMatchObject({
      status: "blocked",
      reason: "budget_exceeded",
      dispatch_allowed: false,
    });
  });

  it("passes an approved budget and preserves local zero-cost metadata", () => {
    const plan = buildLiveCouncilProviderPlan({
      question,
      availability: {
        claude: "unavailable",
        gpt: "unavailable",
        deepseek: "unavailable",
        local_fast: "available",
        local_smart: "available",
      },
    });
    const gate = evaluateCouncilCostGate({
      plan,
      policy: confirmedBudget,
    });

    expect(gate.status).toBe("approved");
    expect(gate.dispatch_allowed).toBe(true);
    expect(gate.cost_estimate.total_estimated_cost_usd).toBe(0);
    expect(gate.cost_estimate.local_stage_cost_usd).toBe(0);
  });

  it("represents unknown cloud pricing as degraded and not dispatchable", () => {
    const plan = buildLiveCouncilProviderPlan({
      question,
      estimated_cost_overrides: {
        claude: null,
      },
    });
    const gate = evaluateCouncilCostGate({
      plan,
      policy: confirmedBudget,
    });

    expect(gate.status).toBe("degraded");
    expect(gate.reason).toBe("unknown_cloud_pricing");
    expect(gate.dispatch_allowed).toBe(false);
    expect(gate.cost_estimate.unknown_pricing_warnings).toContain(
      "Claude has unknown cloud pricing.",
    );
  });

  it("runs answer, anonymous review, and chairman stages through an injected fake runner", async () => {
    const plan = buildLiveCouncilProviderPlan({ question });
    const runner = fakeCouncilRunner();

    const answerStage = await runCouncilAnswerStage({ plan, question, runner });
    expect(answerStage.results).toHaveLength(4);
    expect(answerStage.provider_call_attempted).toBe(true);

    const packet = buildCouncilAnonymizedReviewPacket({
      question,
      reviewer_member_id: "claude",
      answers: answerStage.results,
    });
    expect(packet.provider_identity_hidden).toBe(true);
    expect(packet.model_identity_hidden).toBe(true);
    expect(JSON.stringify(packet)).not.toMatch(
      /"claude"|"gpt"|"deepseek"|"local_fast"|"local_smart"|"provider_id"|"model_id"/i,
    );
    expect(packet.answers.map((answer) => answer.alias)).toEqual([
      "member_b",
      "member_c",
      "member_d",
    ]);

    const reviewStage = await runCouncilReviewStage({
      plan,
      question,
      answer_results: answerStage.results,
      runner,
    });
    expect(reviewStage.results).toHaveLength(4);
    expect(reviewStage.provider_identity_hidden).toBe(true);

    const chairmanStage = await runCouncilChairmanStage({
      plan,
      question,
      answer_results: answerStage.results,
      review_results: reviewStage.results,
      runner,
    });
    expect(chairmanStage.results).toHaveLength(1);
    expect(chairmanStage.results[0]).toMatchObject({
      stage: "chairman",
      member_id: "claude",
      advisory_only: true,
      execution_attempted: false,
      approval_finalization_attempted: false,
    });
  });

  it("runs the live council path only after cost approval and produces advisory synthesis", async () => {
    const plan = buildLiveCouncilProviderPlan({ question });
    const run = await runLiveCouncil({
      question,
      plan,
      budget_policy: confirmedBudget,
      runner: fakeCouncilRunner(),
    });

    expect(run.status).toBe("degraded");
    expect(run.final_answer).toBe("chairman advisory synthesis");
    expect(run.answer_stage.results).toHaveLength(4);
    expect(run.review_stage.results).toHaveLength(4);
    expect(run.chairman_stage.results).toHaveLength(1);
    expect(run.cost_summary.total_estimated_cost_usd).toBe(0.27);
    expect(run.governance_summary).toMatchObject({
      advisory_only: true,
      opt_in_required: true,
      cost_gate_passed: true,
      no_execution_authority: true,
      no_approval_finalization: true,
      no_tool_calls: true,
      no_default_network_calls: true,
      raw_answer_bodies_written_to_telemetry: false,
    });
    expect(summarizeLiveCouncilRun(run)).toContain("live council advisory run");
  });

  it("blocks live council when no runner is injected or confirmation is missing", async () => {
    const plan = buildLiveCouncilProviderPlan({ question });
    const run = await runLiveCouncil({
      question,
      plan,
      budget_policy: {
        ...confirmedBudget,
        user_confirmation_received: false,
      },
    });

    expect(run.status).toBe("blocked");
    expect(run.answer_stage.provider_call_attempted).toBe(false);
    expect(run.review_stage.provider_call_attempted).toBe(false);
    expect(run.chairman_stage.provider_call_attempted).toBe(false);
    expect(run.governance_summary.cost_gate_passed).toBe(false);
  });

  it("publishes a realization closeout with the required advisory wording", () => {
    const closeout = buildCouncilRealizationCloseoutReport();

    expect(closeout.title).toBe(
      "Council Mode realized as opt-in cost-gated live provider reasoning workflow",
    );
    expect(closeout.target_roster).toEqual([
      "claude",
      "gpt",
      "deepseek",
      "local_fast",
      "local_smart",
    ]);
    expect(closeout.gemini_member_present).toBe(false);
    expect(closeout.components).toEqual(
      expect.arrayContaining([
        "live_provider_plan",
        "council_cost_gate",
        "injected_provider_dispatch_boundary",
        "independent_answer_stage",
        "anonymous_peer_review_stage",
        "chairman_synthesis_stage",
      ]),
    );
    expect(closeout.governance_checks).toMatchObject({
      advisory_only: true,
      cost_gate_required: true,
      injected_provider_boundary: true,
      no_default_provider_calls: true,
      no_execution_authority: true,
      no_approval_finalization: true,
      no_tool_calls: true,
      no_autonomous_triggering: true,
      no_raw_answer_telemetry: true,
      no_hidden_cloud_escalation: true,
    });
  });

  it("keeps the live council module free of direct provider, network, and mutation paths", () => {
    const source = readFileSync("src/lib/council/live-council.ts", "utf8");

    expect(source).not.toMatch(/from ["'](?:openai|@anthropic-ai|anthropic)/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\baxios\b/i);
    expect(source).not.toMatch(/\bchild_process\b|\bexec\s*\(|\bspawn\s*\(/);
    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/\bwriteFile(?:Sync)?\s*\(/);
    expect(source).not.toMatch(/\bapproveAction\b|\bfinalizeApproval\b/);
    expect(source).not.toMatch(/\bgemini\b/i);
  });
});

function fakeCouncilRunner(): CouncilProviderRunner {
  return {
    run(request: CouncilProviderRequest): CouncilProviderResult {
      return {
        request_id: request.request_id,
        stage: request.stage,
        member_id: request.member_id,
        model_id: request.model_id,
        status: "succeeded",
        answer_summary: answerForStage(request.stage),
        confidence: request.stage === "chairman" ? "high" : "medium",
        caveats:
          request.stage === "review"
            ? ["anonymous review caveat"]
            : ["advisory-only output"],
        latency_ms: 12,
        token_usage: { input_tokens: 100, output_tokens: 50 },
        raw_body_written_to_telemetry: false,
        advisory_only: true,
        execution_attempted: false,
        approval_finalization_attempted: false,
        tool_call_attempted: false,
        network_call_attempted: false,
      };
    },
  };
}

function answerForStage(stage: CouncilProviderRequest["stage"]): string {
  if (stage === "chairman") return "chairman advisory synthesis";
  if (stage === "review") return "anonymous critique summary";
  return "independent advisory answer";
}
