import { RestCommandCenter } from "@/components/command-center/RestCommandCenter";
import { buildRestCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";

export default function Home() {
  const model = buildRestCommandCenterModel();

  return (
    <main aria-label="JARVIS command center" data-surface="command-center">
      <RestCommandCenter activeRoute="home" model={model} />
    </main>
  );
}
