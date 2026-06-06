import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { buildRestCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";

export default function RestPage() {
  const model = buildRestCommandCenterModel();

  return (
    <main aria-label="JARVIS rest command center" data-surface="command-center">
      <RestCommandCenter activeRoute="rest" model={model} />
    </main>
  );
}
