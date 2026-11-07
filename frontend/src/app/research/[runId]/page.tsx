import type { Metadata } from "next";
import { RunView } from "@/components/research/RunView";

export const metadata: Metadata = { title: "Research run" };

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunView runId={runId} />;
}
