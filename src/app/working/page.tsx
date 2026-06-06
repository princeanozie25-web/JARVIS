import { WorkingCockpit } from "@/components/working/WorkingCockpit";
import { buildWorkingCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";

export default function WorkingPage() {
  const model = buildWorkingCommandCenterModel();

  return (
    <main
      aria-label="JARVIS Working cockpit"
      data-working-layout="approval-gated-cockpit"
      data-working-layout-style="working-cockpit"
    >
      <WorkingCockpit model={model} />
    </main>
  );
}
