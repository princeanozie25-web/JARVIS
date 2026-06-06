import { redirect } from "next/navigation";

export default function RemovedLegacyCinematicRoute() {
  redirect("/audit/pipeline");
}
