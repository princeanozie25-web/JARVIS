import { Orb } from "@/components/orb/Orb";
import { IDLE_ORB_STATE } from "@/components/orb/state-tokens";

export default function RestPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <Orb state={IDLE_ORB_STATE} />
      </div>
    </main>
  );
}
