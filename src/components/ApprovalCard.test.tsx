import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprovalCard, type ApprovalCardDetails } from "./ApprovalCard";

const approval: ApprovalCardDetails = {
  executionId: "exec-1",
  toolId: "mock.confirm",
  toolName: "Mock Confirm",
  scopeHash: "scope-1",
  requiredSafetyTag: "CONFIRM_ONCE",
  safetyTag: "ALLOW",
  summary: "fields: value",
  approvalExpiresAt: 1_000,
  status: "pending",
};

describe("ApprovalCard", () => {
  it("renders approval actions inline", () => {
    const html = renderToStaticMarkup(
      <ApprovalCard approval={approval} onDecision={() => undefined} />,
    );

    expect(html).toContain("Mock Confirm");
    expect(html).toContain("fields: value");
    expect(html).toContain("Approve Once");
    expect(html).toContain("Approve Session");
    expect(html).toContain("Deny");
  });
});
