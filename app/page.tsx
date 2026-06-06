import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";

export default function Home() {
  return (
    <RestCommandCenter
      activeRoute="home"
      marker={SYNTHETIC_OBSERVABILITY_MARKER}
    />
  );
}
