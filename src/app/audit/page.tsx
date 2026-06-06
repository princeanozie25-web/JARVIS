import { AuditCockpit } from "@/components/audit/AuditCockpit";
import { buildAuditCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";

export default function AuditPage() {
  const model = buildAuditCommandCenterModel();

  return (
    <main data-audit-layout="read-only-forensics" data-audit-authority="none">
      <AuditCockpit model={model} />
    </main>
  );
}
