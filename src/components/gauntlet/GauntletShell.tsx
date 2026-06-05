import { GauntletCanvas } from "./GauntletCanvas";
import { GauntletOverlay } from "./GauntletOverlay";

export function GauntletShell() {
  return (
    <main
      aria-label="JARVIS Infinity Gauntlet"
      data-audit-surface="gauntlet"
      data-gauntlet-surface-style="cinematic-cosmic-system"
      data-gauntlet-cinematic-shell="true"
      data-gauntlet-two-layer-architecture="canvas-plus-react-overlay"
      className="jarvis-gauntlet-cinematic relative min-h-screen overflow-hidden px-3 py-3 text-ink sm:px-5 sm:py-5"
    >
      <a className="jarvis-skip-link" href="#gauntlet-pipeline">
        Skip to Infinity Gauntlet
      </a>
      <div
        aria-hidden="true"
        data-gauntlet-galaxy-backdrop="starfield"
        className="jarvis-gauntlet-galaxy-backdrop pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden="true"
        data-gauntlet-nebula-backdrop="cosmic-depth"
        className="jarvis-gauntlet-nebula pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden="true"
        data-gauntlet-asset-backdrop="nasa-webb-carina-cosmic-cliffs"
        className="jarvis-gauntlet-cosmic-asset-backdrop pointer-events-none fixed inset-0"
      />
      <GauntletCanvas />
      <GauntletOverlay />
    </main>
  );
}
