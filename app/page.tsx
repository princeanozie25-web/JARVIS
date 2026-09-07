// JARVIS · the presence. Server component; the screen itself is a client
// component. docs/design/PRESENCE_THESIS.md is the design authority.
import type { Metadata } from "next";

import { PresenceScreen } from "@/components/presence/PresenceScreen";

export const metadata: Metadata = {
  title: "JARVIS",
  description: "Personal AI operating environment for Prince Anozie.",
};

export default function Page() {
  return (
    <main aria-label="JARVIS" data-surface="presence">
      <PresenceScreen />
    </main>
  );
}
