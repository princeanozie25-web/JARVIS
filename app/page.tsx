import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";

export default function Home() {
  return (
    <main aria-label="JARVIS command center" data-surface="command-center">
      <RestCommandCenter
        activeRoute="home"
        marker={SYNTHETIC_OBSERVABILITY_MARKER}
      />
    </main>
  );
}
