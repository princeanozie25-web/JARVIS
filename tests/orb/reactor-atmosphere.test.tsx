import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Orb } from "@/components/orb/Orb";
import { OrbReactorAtmosphere } from "@/components/orb/OrbReactorAtmosphere";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
};
const atmosphereSource = readFileSync(
  "src/components/orb/OrbReactorAtmosphere.tsx",
  "utf8",
);
const orbSource = readFileSync("src/components/orb/Orb.tsx", "utf8");

describe("Orb Reactor Three.js atmosphere", () => {
  it("declares the required Three.js dependencies", () => {
    expect(packageJson.dependencies).toHaveProperty("three");
    expect(packageJson.dependencies).toHaveProperty("@react-three/fiber");
    expect(packageJson.dependencies).toHaveProperty("@react-three/drei");
  });

  it("renders an optional non-interactive atmosphere wrapper with safe fallback", () => {
    const markup = renderToStaticMarkup(
      <OrbReactorAtmosphere presentationalState="processing" />,
    );

    expect(markup).toContain('data-orb-atmosphere="threejs"');
    expect(markup).toContain('data-orb-atmosphere-state="processing"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain(
      'data-orb-atmosphere-fallback="reduced-motion-or-webgl-unavailable"',
    );
  });

  it("uses React Three Fiber and drei without camera/control helpers", () => {
    expect(atmosphereSource).toContain('from "@react-three/fiber"');
    expect(atmosphereSource).toContain('from "@react-three/drei"');
    expect(atmosphereSource).toContain("<Canvas");
    expect(atmosphereSource).not.toMatch(
      /OrbitControls|CameraControls|PresentationControls/,
    );
  });

  it("keeps the Canvas presentational and pointer-events disabled", () => {
    expect(atmosphereSource).toMatch(/<Canvas[\s\S]*aria-hidden="true"/);
    expect(atmosphereSource).toMatch(
      /<Canvas[\s\S]*className="pointer-events-none/,
    );
    expect(atmosphereSource).not.toMatch(/\bonClick\b|\bonPointerDown\b/);
  });

  it("contains reduced-motion and WebGL fallback gates", () => {
    expect(atmosphereSource).toContain("prefers-reduced-motion: reduce");
    expect(atmosphereSource).toContain("canUseWebGL");
    expect(atmosphereSource).toContain(
      'data-orb-atmosphere-fallback="reduced-motion-or-webgl-unavailable"',
    );
  });

  it("only receives the resolved presentational activity state from Orb", () => {
    expect(orbSource).toContain(
      "<OrbReactorAtmosphere presentationalState={activity.state} />",
    );
    expect(orbSource).not.toContain("projectionState={");
    expect(orbSource).not.toContain("projectionTokens={");
  });

  it("preserves Orb state attributes and read-only invariants", () => {
    const markup = renderToStaticMarkup(<Orb activityState="listening" />);

    expect(markup).toContain('data-orb-activity-state="listening"');
    expect(markup).toContain('data-orb-layer="core"');
    expect(markup).toContain('data-orb-atmosphere="threejs"');
    expect(markup).not.toMatch(
      /<button\b|<form\b|<input\b|<textarea\b|<select\b|<a\b/i,
    );
  });
});
