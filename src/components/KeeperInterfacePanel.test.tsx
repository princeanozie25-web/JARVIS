import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeeperMetadata } from "../lib/keepers";
import { KeeperInterfacePanel } from "./KeeperInterfacePanel";

const keeper: KeeperMetadata = {
  id: "metadata-only",
  name: "Metadata Only Keeper",
  description: "Registered metadata for an inert Keeper skeleton.",
  requiredConsentFeature: "keeper_interface",
  supportedOperations: ["describe"],
  dataClasses: ["metadata"],
  status: "registered",
};

describe("KeeperInterfacePanel", () => {
  it("renders skeleton status, no concrete keepers copy, and registered metadata", () => {
    const html = renderToStaticMarkup(
      <KeeperInterfacePanel keepers={[keeper]} consentEnabled />,
    );

    expect(html).toContain("Keeper Interface");
    expect(html).toContain("Skeleton metadata registry");
    expect(html).toContain("No concrete Keepers installed.");
    expect(html).toContain("no execution endpoint");
    expect(html).toContain("Metadata Only Keeper");
    expect(html).toContain("Operations metadata");
    expect(html).toContain("Data classes metadata");
  });

  it("renders disabled and empty registry states", () => {
    const html = renderToStaticMarkup(
      <KeeperInterfacePanel keepers={[]} consentEnabled={false} />,
    );

    expect(html).toContain(
      "Keeper Interface is disabled until consent is enabled.",
    );
    expect(html).toContain("No Keeper metadata registered.");
  });
});
