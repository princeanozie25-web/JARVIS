import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "JARVIS Pipeline",
  description:
    "Legacy cinematic prototype URL redirected to the governed pipeline surface.",
};

export default function RemovedLegacyCinematicPrototypeRoute() {
  redirect("/audit/pipeline");
}
