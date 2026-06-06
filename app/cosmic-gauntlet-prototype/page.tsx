import type { Metadata } from "next";

import { CosmicGauntletPrototype } from "@/components/cosmic-gauntlet-prototype";

import "@/components/cosmic-gauntlet-prototype/cosmic-gauntlet-prototype.css";

export const metadata: Metadata = {
  title: "Cosmic Gauntlet Prototype | JARVIS",
  description:
    "Standalone cinematic JARVIS Cosmic Gauntlet prototype for visual navigation only.",
};

export default function CosmicGauntletPrototypePage() {
  return <CosmicGauntletPrototype />;
}
