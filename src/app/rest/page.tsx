import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";

export default function RestPage() {
  return (
    <main aria-label="JARVIS rest command center" data-surface="command-center">
      <RestCommandCenter
        activeRoute="rest"
        marker={SYNTHETIC_OBSERVABILITY_MARKER}
      />
    </main>
  );
}
