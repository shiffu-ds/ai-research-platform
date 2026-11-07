import type { Metadata } from "next";
import { ResearchIndex } from "./ResearchIndex";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage() {
  return <ResearchIndex />;
}
