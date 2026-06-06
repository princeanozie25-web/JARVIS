import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";

export default function RestPage() {
  return (
    <RestCommandCenter
      activeRoute="rest"
      marker={SYNTHETIC_OBSERVABILITY_MARKER}
    />
  );
}
