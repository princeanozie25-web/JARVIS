import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PreferenceRow } from "@/lib/db/node";
import { PreferenceLedgerPanel } from "./PreferenceLedgerPanel";

const currentPreference: PreferenceRow = {
  id: "pref-2",
  key: "tone",
  value: "Prefer concise answers.",
  category: "communication",
  source: "user",
  effective_from: 3_000,
  supersedes_id: "pref-1",
  created_at: 3_000,
};

const historicPreference: PreferenceRow = {
  id: "pref-1",
  key: "tone",
  value: "Prefer detailed answers.",
  category: "communication",
  source: "user",
  effective_from: 2_000,
  supersedes_id: null,
  created_at: 2_000,
};

describe("PreferenceLedgerPanel", () => {
  it("renders add form, effective preferences, and history", () => {
    const html = renderToStaticMarkup(
      <PreferenceLedgerPanel
        current={[currentPreference]}
        history={[currentPreference, historicPreference]}
        consentEnabled
        onAdd={() => undefined}
      />,
    );

    expect(html).toContain("Preference Ledger");
    expect(html).toContain("Add Preference");
    expect(html).toContain("Current Effective Preferences");
    expect(html).toContain("Preference History");
    expect(html).toContain("Prefer concise answers.");
    expect(html).toContain("Prefer detailed answers.");
    expect(html).toContain("supersedes pref-1");
  });

  it("shows disabled consent state", () => {
    const html = renderToStaticMarkup(
      <PreferenceLedgerPanel
        current={[]}
        history={[]}
        consentEnabled={false}
        onAdd={() => undefined}
      />,
    );

    expect(html).toContain(
      "Preferences are disabled until consent is enabled.",
    );
    expect(html).toContain("No effective preferences stored.");
    expect(html).toContain("No preference history stored.");
  });
});
