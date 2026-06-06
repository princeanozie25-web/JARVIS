import { AuditCockpit } from "@/components/audit/AuditCockpit";
import {
  SYNTHETIC_OBSERVABILITY_MARKER,
  syntheticAuditPanels,
} from "@/lib/observability/synthetic-data";

export default function AuditPage() {
  return (
    <main
      data-audit-layout="read-only-forensics"
      className="min-h-screen overflow-hidden bg-[#02040a] p-4 text-white"
    >
      <div className="relative mx-auto max-w-[1720px]">
        <AuditCockpit
          marker={SYNTHETIC_OBSERVABILITY_MARKER}
          projectionPanels={syntheticAuditPanels()}
        />
      </div>
    </main>
  );
}
